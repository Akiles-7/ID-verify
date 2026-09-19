package com.drs.idverify.service;

import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.model.*;
import com.drs.idverify.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CaseService {

    private final CaseRepository caseRepository;
    private final OcrFieldsRepository ocrFieldsRepository;
    private final ValidationCheckRepository validationCheckRepository;
    private final TamperResultRepository tamperResultRepository;
    private final FaceResultRepository faceResultRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CaseService(CaseRepository caseRepository, OcrFieldsRepository ocrFieldsRepository,
                       ValidationCheckRepository validationCheckRepository, TamperResultRepository tamperResultRepository,
                       FaceResultRepository faceResultRepository, RiskScoreRepository riskScoreRepository,
                       AuditLogService auditLogService) {
        this.caseRepository = caseRepository;
        this.ocrFieldsRepository = ocrFieldsRepository;
        this.validationCheckRepository = validationCheckRepository;
        this.tamperResultRepository = tamperResultRepository;
        this.faceResultRepository = faceResultRepository;
        this.riskScoreRepository = riskScoreRepository;
        this.auditLogService = auditLogService;
    }

    public Page<CaseSummaryDto> getCases(String filter, String search, int page, int size) {
        String filterValue = (filter == null || filter.equalsIgnoreCase("ALL")) ? "ALL" : filter.toUpperCase();
        String searchValue = (search != null && !search.isBlank()) ? search.trim() : null;

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<CaseEntity> caseEntities = caseRepository.findFilteredCases(filterValue, searchValue, pageRequest);

        return caseEntities.map(c -> CaseSummaryDto.builder()
                .id(c.getId())
                .caseCode(c.getCaseCode())
                .subjectName(c.getSubjectName())
                .documentType(c.getDocumentType())
                .status(c.getStatus())
                .riskScore(c.getRiskScore())
                .riskBand(c.getRiskBand())
                .createdAt(c.getCreatedAt())
                .timeAgo(c.getCreatedAt() != null ? c.getCreatedAt().toLocalTime().toString().substring(0, 5) : "")
                .build());
    }

    public ScanResultDto getCaseDetail(Long id) {
        CaseEntity c = caseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Case not found: " + id));

        OcrFields ocr = ocrFieldsRepository.findByCaseEntityId(id).orElse(null);
        List<ValidationCheck> checks = validationCheckRepository.findByCaseEntityId(id);
        TamperResult tamper = tamperResultRepository.findByCaseEntityId(id).orElse(null);
        FaceResult face = faceResultRepository.findByCaseEntityId(id).orElse(null);
        RiskScore risk = riskScoreRepository.findByCaseEntityId(id).orElse(null);

        // Build OCR map purely from DB — no hardcoded fallbacks
        Map<String, Object> ocrMap = null;
        if (ocr != null) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("surname", ocr.getSurname());
            m.put("given_names", ocr.getGivenNames());
            m.put("document_number", ocr.getDocumentNumber());
            m.put("nationality", ocr.getNationality());
            m.put("date_of_birth", ocr.getDateOfBirth() != null ? ocr.getDateOfBirth().toString() : null);
            m.put("sex", ocr.getSex());
            m.put("expiry_date", ocr.getExpiryDate() != null ? ocr.getExpiryDate().toString() : null);
            m.put("issuing_country", ocr.getIssuingCountry());
            m.put("personal_number", ocr.getPersonalNumber());
            m.put("mrz_line1", ocr.getMrzLine1());
            m.put("mrz_line2", ocr.getMrzLine2());
            m.put("ocr_engine", ocr.getOcrEngine());
            m.put("processing_ms", ocr.getProcessingMs());
            ocrMap = m;
        }

        // Validation map from DB
        Map<String, Object> validationMap = null;
        if (!checks.isEmpty()) {
            long passCount = checks.stream().filter(ValidationCheck::getPassed).count();
            long failCount = checks.size() - passCount;
            List<Map<String, Object>> checksList = checks.stream().map(v -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("checkGroup", v.getCheckGroup());
                m.put("checkName", v.getCheckName());
                m.put("passed", v.getPassed());
                m.put("computedValue", v.getComputedValue() != null ? v.getComputedValue() : "");
                m.put("storedValue", v.getStoredValue() != null ? v.getStoredValue() : "");
                m.put("detail", v.getDetail() != null ? v.getDetail() : "");
                return m;
            }).collect(Collectors.toList());
            validationMap = Map.of("passCount", passCount, "failCount", failCount, "checks", checksList);
        }

        // Tamper map from DB
        Map<String, Object> tamperMap = null;
        if (tamper != null) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ela_score", tamper.getElaScore());
            m.put("metadata_score", tamper.getMetadataScore());
            m.put("region_consistency_score", tamper.getRegionConsistencyScore());
            m.put("overall_tamper_confidence", tamper.getOverallTamperConfidence());
            m.put("heatmap_image_url", tamper.getHeatmapImagePath());
            m.put("heatmap_b64", tamper.getHeatmapB64());
            m.put("exif_flags", tamper.getExifFlags());
            m.put("hotspots", tamper.getHotspots());
            tamperMap = m;
        }

        // Face map from DB
        Map<String, Object> faceMap = null;
        if (face != null) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("distance", face.getDistance());
            m.put("threshold", face.getThresholdUsed());
            m.put("match", face.getMatchResult());
            m.put("model", face.getModel());
            m.put("embedding_dim", face.getEmbeddingDim());
            m.put("doc_confidence", face.getDocFaceConfidence());
            m.put("live_confidence", face.getLiveFaceConfidence());
            m.put("liveness_score", face.getLivenessScore());
            m.put("liveness_status", face.getLivenessStatus());
            m.put("blink_detected", face.getBlinkDetected());
            m.put("head_motion_detected", face.getHeadMotionDetected());
            m.put("liveness_reason", face.getLivenessReason());
            m.put("comparison_performed", face.getComparisonPerformed() != null && face.getComparisonPerformed());
            m.put("status", face.getMatchStatus());
            faceMap = m;
        }

        // Risk map from DB — parse active_flags JSON from stored string
        Map<String, Object> riskMap = null;
        if (risk != null) {
            List<String> activeFlags = new ArrayList<>();
            try {
                if (risk.getActiveFlags() != null && !risk.getActiveFlags().isBlank()) {
                    activeFlags = objectMapper.readValue(risk.getActiveFlags(), new TypeReference<>() {});
                }
            } catch (Exception e) {
                // Parse as bracket-wrapped comma list if not JSON
                String raw = risk.getActiveFlags().replaceAll("^\\[|]$", "");
                activeFlags = Arrays.stream(raw.split(",")).map(String::trim).collect(Collectors.toList());
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("total_score", risk.getTotalScore());
            m.put("band", risk.getBand());
            m.put("contributions", Map.of(
                    "mrz", risk.getContributionMrz() != null ? risk.getContributionMrz() : 0,
                    "tamper", risk.getContributionTamper() != null ? risk.getContributionTamper() : 0,
                    "face", risk.getContributionFace() != null ? risk.getContributionFace() : 0,
                    "validation", risk.getContributionValidation() != null ? risk.getContributionValidation() : 0
            ));
            m.put("active_flags", activeFlags);
            m.put("formula", risk.getFormula());
            m.put("w1", risk.getW1MrzChecksum());
            m.put("w2", risk.getW2Tampering());
            m.put("w3", risk.getW3FaceNonmatch());
            m.put("w4", risk.getW4ValidationFailures());
            riskMap = m;
        }

        List<Map<String, Object>> logsList = null;
        if (c.getPipelineLogs() != null && !c.getPipelineLogs().isBlank()) {
            try {
                logsList = objectMapper.readValue(c.getPipelineLogs(), new TypeReference<List<Map<String, Object>>>() {});
            } catch (Exception e) {
                // Non-fatal
            }
        }

        return ScanResultDto.builder()
                .caseId(c.getId())
                .caseCode(c.getCaseCode())
                .subjectName(c.getSubjectName())
                .documentType(c.getDocumentType())
                .status(c.getStatus())
                .documentImagePath(c.getDocumentImagePath())
                .liveCaptureImagePath(c.getLiveCaptureImagePath())
                .ocr(ocrMap)
                .validation(validationMap)
                .tampering(tamperMap)
                .face(faceMap)
                .liveness(buildLivenessMap(faceMap))
                .risk(riskMap)
                .logs(logsList)
                .build();
    }

    @Transactional
    public void markCleared(Long id, Long officerId) {
        CaseEntity c = caseRepository.findById(id).orElseThrow(() -> new RuntimeException("Case not found"));
        c.setStatus("CLEARED");
        c.setDecidedAt(LocalDateTime.now());
        caseRepository.save(c);
        auditLogService.log("CLEAR", officerId, c, "127.0.0.1", "Officer marked case " + c.getCaseCode() + " as CLEARED");
    }

    @Transactional
    public void markCleared(String idOrCode, Long officerId) {
        CaseEntity c = findByIdOrCaseCode(idOrCode);
        markCleared(c.getId(), officerId);
    }

    @Transactional
    public void markEscalated(Long id, Long officerId) {
        CaseEntity c = caseRepository.findById(id).orElseThrow(() -> new RuntimeException("Case not found"));
        c.setStatus("FLAGGED");
        c.setDecidedAt(LocalDateTime.now());
        caseRepository.save(c);
        auditLogService.log("ESCALATE", officerId, c, "127.0.0.1", "Officer escalated case " + c.getCaseCode() + " as FLAGGED");
    }

    @Transactional
    public void markEscalated(String idOrCode, Long officerId) {
        CaseEntity c = findByIdOrCaseCode(idOrCode);
        markEscalated(c.getId(), officerId);
    }

    @Transactional
    public void deleteCase(Long id, Long officerId) {
        CaseEntity c = caseRepository.findById(id).orElseThrow(() -> new RuntimeException("Case not found"));
        ocrFieldsRepository.findByCaseEntityId(id).ifPresent(ocrFieldsRepository::delete);
        validationCheckRepository.findByCaseEntityId(id).forEach(validationCheckRepository::delete);
        tamperResultRepository.findByCaseEntityId(id).ifPresent(tamperResultRepository::delete);
        faceResultRepository.findByCaseEntityId(id).ifPresent(faceResultRepository::delete);
        riskScoreRepository.findByCaseEntityId(id).ifPresent(riskScoreRepository::delete);
        auditLogService.log("DELETE", officerId, null, "127.0.0.1", "Admin deleted case " + c.getCaseCode() + " (" + c.getSubjectName() + ")");
        caseRepository.delete(c);
    }

    @Transactional
    public void deleteCase(String idOrCode, Long officerId) {
        CaseEntity c = findByIdOrCaseCode(idOrCode);
        deleteCase(c.getId(), officerId);
    }

    public ScanResultDto getCaseDetail(String idOrCode) {
        CaseEntity c = findByIdOrCaseCode(idOrCode);
        return getCaseDetail(c.getId());
    }

    public CaseEntity findByIdOrCaseCode(String idOrCode) {
        if (idOrCode == null || idOrCode.isBlank()) {
            throw new RuntimeException("Case identifier is required");
        }
        try {
            Long id = Long.parseLong(idOrCode);
            Optional<CaseEntity> byId = caseRepository.findById(id);
            if (byId.isPresent()) return byId.get();
        } catch (NumberFormatException ignored) {}

        return caseRepository.findByCaseCode(idOrCode)
                .orElseThrow(() -> new RuntimeException("Case not found for identifier: " + idOrCode));
    }
    private Map<String, Object> buildLivenessMap(Map<String, Object> faceMap) {
        if (faceMap == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("liveness_score", faceMap.get("liveness_score"));
        m.put("liveness_status", faceMap.get("liveness_status"));
        m.put("blink_detected", faceMap.get("blink_detected"));
        m.put("motion_detected", faceMap.get("head_motion_detected"));
        m.put("liveness_reason", faceMap.get("liveness_reason"));
        return m;
    }

}
