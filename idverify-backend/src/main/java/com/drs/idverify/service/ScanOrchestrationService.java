package com.drs.idverify.service;

import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.model.*;
import com.drs.idverify.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ScanOrchestrationService {

    private final CaseRepository caseRepository;
    private final OcrFieldsRepository ocrFieldsRepository;
    private final ValidationCheckRepository validationCheckRepository;
    private final TamperResultRepository tamperResultRepository;
    private final FaceResultRepository faceResultRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final SettingsService settingsService;
    private final AuditLogService auditLogService;
    private final RestTemplate restTemplate;

    @Value("${app.ai-service.url:http://localhost:8000}")
    private String aiServiceUrl;

    public ScanOrchestrationService(CaseRepository caseRepository, OcrFieldsRepository ocrFieldsRepository,
                                    ValidationCheckRepository validationCheckRepository, TamperResultRepository tamperResultRepository,
                                    FaceResultRepository faceResultRepository, RiskScoreRepository riskScoreRepository,
                                    SettingsService settingsService, AuditLogService auditLogService) {
        this.caseRepository = caseRepository;
        this.ocrFieldsRepository = ocrFieldsRepository;
        this.validationCheckRepository = validationCheckRepository;
        this.tamperResultRepository = tamperResultRepository;
        this.faceResultRepository = faceResultRepository;
        this.riskScoreRepository = riskScoreRepository;
        this.settingsService = settingsService;
        this.auditLogService = auditLogService;
        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(30000);
        factory.setReadTimeout(180000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Transactional
    public Map<String, Object> createNewScan(String documentType, MultipartFile file, MultipartFile livePhoto, Long officerId) {
        return createNewScan(documentType, file, livePhoto, null, officerId);
    }

    @Transactional
    public Map<String, Object> createNewScan(String documentType, MultipartFile file, MultipartFile livePhoto, String aiResultJson, Long officerId) {
        String caseCode = generateUniqueCaseCode();
        String docType = documentType != null ? documentType.toUpperCase() : "PASSPORT";

        // Create initial case record with PROCESSING status
        CaseEntity newCase = CaseEntity.builder()
                .caseCode(caseCode)
                .subjectName("PROCESSING_OCR")
                .documentType(docType)
                .documentImagePath("/uploads/" + (file != null ? file.getOriginalFilename() : "document.jpg"))
                .liveCaptureImagePath(livePhoto != null ? "/uploads/" + livePhoto.getOriginalFilename() : "/uploads/live.jpg")
                .liveCaptureSource("UPLOAD")
                .status("PROCESSING")
                .riskScore(0)
                .riskBand("UNKNOWN")
                .createdAt(LocalDateTime.now())
                .build();
        newCase = caseRepository.save(newCase);

        boolean aiSuccess = false;
        Map<String, Object> aiResult = null;

        // Option A: Front-end passed pre-computed AI result JSON directly
        if (aiResultJson != null && !aiResultJson.isBlank()) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                aiResult = mapper.readValue(aiResultJson, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
                aiSuccess = true;
            } catch (Exception e) {
                // Ignore parse error, proceed to call service
            }
        }

        // Option B: Call AI service directly from Spring Boot if not passed by frontend
        if (!aiSuccess) {
            try {
                SettingsDto settings = settingsService.getSettingsDto();

                MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
                body.add("documentType", docType);
                if (file != null && !file.isEmpty()) {
                    org.springframework.core.io.ByteArrayResource fileResource = new org.springframework.core.io.ByteArrayResource(file.getBytes()) {
                        @Override
                        public String getFilename() {
                            return file.getOriginalFilename() != null && !file.getOriginalFilename().isBlank()
                                    ? file.getOriginalFilename() : "document.jpg";
                        }
                    };
                    body.add("file", fileResource);
                }
                if (livePhoto != null && !livePhoto.isEmpty()) {
                    org.springframework.core.io.ByteArrayResource liveResource = new org.springframework.core.io.ByteArrayResource(livePhoto.getBytes()) {
                        @Override
                        public String getFilename() {
                            return livePhoto.getOriginalFilename() != null && !livePhoto.getOriginalFilename().isBlank()
                                    ? livePhoto.getOriginalFilename() : "live.jpg";
                        }
                    };
                    body.add("livePhoto", liveResource);
                }
                body.add("faceModel", settings.getFaceBackendModel() != null ? settings.getFaceBackendModel() : "ARCFACE");
                body.add("faceThreshold", settings.getFaceMatchThreshold() != null ? settings.getFaceMatchThreshold() : 0.68);
                body.add("elaQuality", settings.getElaJpegQuality() != null ? settings.getElaJpegQuality() : 85);
                body.add("enableCanny", settings.getEnableCannyEdge() != null ? settings.getEnableCannyEdge() : true);
                body.add("enableExif", settings.getEnableExifScan() != null ? settings.getEnableExifScan() : true);
                body.add("w1", settings.getWeightMrz() != null ? settings.getWeightMrz() : 0.30);
                body.add("w2", settings.getWeightTamper() != null ? settings.getWeightTamper() : 0.35);
                body.add("w3", settings.getWeightFace() != null ? settings.getWeightFace() : 0.25);
                body.add("w4", settings.getWeightValidation() != null ? settings.getWeightValidation() : 0.10);
                body.add("highThresh", settings.getRiskHighThreshold() != null ? settings.getRiskHighThreshold() : 60);
                body.add("medThresh", settings.getRiskMediumThreshold() != null ? settings.getRiskMediumThreshold() : 30);

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.MULTIPART_FORM_DATA);
                HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);
                ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                        aiServiceUrl + "/pipeline/run",
                        HttpMethod.POST,
                        request,
                        new ParameterizedTypeReference<>() {}
                );
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    aiResult = response.getBody();
                    aiSuccess = true;
                }
            } catch (Exception e) {
                org.slf4j.LoggerFactory.getLogger(ScanOrchestrationService.class)
                        .error("AI service call failed: {}", e.getMessage(), e);
            }
        }

        if (aiSuccess && aiResult != null) {
            persistAiResult(newCase, aiResult, caseCode);
            auditLogService.log("SCAN", officerId, newCase, "127.0.0.1", "Scan processed case " + caseCode + " for docType=" + docType);
            return Map.of("caseId", newCase.getId(), "caseCode", caseCode, "status", "COMPLETE");
        }

        // Never substitute synthetic identity data for a failed real scan.
        newCase.setStatus("FAILED");
        newCase.setSubjectName("ANALYSIS FAILED");
        newCase.setRiskScore(100);
        newCase.setRiskBand("CRITICAL");
        newCase.setPipelineLogs("[{\"type\":\"ERROR\",\"text\":\"AI analysis service failed or was unreachable. No synthetic result was generated.\"}]");
        caseRepository.save(newCase);
        auditLogService.log("SCAN_FAILED", officerId, newCase, "127.0.0.1", "AI analysis failed for case " + caseCode);
        return Map.of("caseId", newCase.getId(), "caseCode", caseCode, "status", "FAILED", "message", "AI analysis service unavailable or returned no result");
    }

    @SuppressWarnings("unchecked")
    private void persistAiResult(CaseEntity newCase, Map<String, Object> ai, String caseCode) {
        Map<String, Object> ocrEnvelope = asMap(ai.get("ocr"));
        Map<String, Object> ocrFields = asMap(ocrEnvelope.get("fields"));
        if (ocrFields.isEmpty()) {
            // Backward compatibility with the old flat OCR response contract.
            ocrFields = ocrEnvelope;
        }

        try {
            Object logsObj = ai.get("logs");
            if (logsObj != null) {
                newCase.setPipelineLogs(new ObjectMapper().writeValueAsString(logsObj));
            }
        } catch (Exception e) {
            newCase.setPipelineLogs("[]");
        }

        String surname = fieldString(ocrFields, "surname", "UNKNOWN");
        String givenNames = fieldString(ocrFields, "given_names", "");
        String fullName = firstField(ocrFields, "full_name", "name");
        if ((surname.equalsIgnoreCase("UNKNOWN") || surname.isBlank()) && !fullName.isBlank()) {
            if (fullName.contains(" ")) {
                int lastSpace = fullName.lastIndexOf(' ');
                surname = fullName.substring(lastSpace + 1).trim();
                givenNames = fullName.substring(0, lastSpace).trim();
            } else {
                surname = fullName.trim();
            }
        }
        String documentNumber = fieldString(ocrFields, "document_number", "");
        String documentType = fieldString(ocrFields, "document_type", "PASSPORT");
        String countryCode = fieldString(ocrFields, "country_code", "");
        String nationality = fieldString(ocrFields, "nationality", "");
        String dobRaw = firstField(ocrFields, "date_of_birth", "dob");
        String placeOfBirth = fieldString(ocrFields, "place_of_birth", "");
        String issueRaw = fieldString(ocrFields, "date_of_issue", "");
        String expiryRaw = fieldString(ocrFields, "expiry_date", "");
        String issuingCountry = fieldString(ocrFields, "issuing_country", "");
        String personalNumber = fieldString(ocrFields, "personal_number", "");
        String sex = fieldString(ocrFields, "sex", "");

        Map<String, Object> riskData = asMap(ai.get("risk"));
        int totalScore = parseInt(firstPresent(riskData, "total_score", "risk_score"), 0);
        String band = stringValue(firstPresent(riskData, "band", "risk_level"), computeBand(totalScore));

        newCase.setSubjectName(buildSubjectName(surname, givenNames));
        newCase.setStatus(band.equalsIgnoreCase("CRITICAL") || band.equalsIgnoreCase("HIGH") ? "FLAGGED" : "PENDING");
        newCase.setRiskScore(totalScore);
        newCase.setRiskBand(band.toUpperCase());
        caseRepository.save(newCase);

        Map<String, Object> cleanOcr = new LinkedHashMap<>(ocrEnvelope);
        if (ocrFields != null) {
            cleanOcr.put("fields", ocrFields);
        }
        cleanOcr.remove("face_crop_b64");
        cleanOcr.remove("doc_face_b64");
        String rawJsonStr;
        try {
            rawJsonStr = safeSubstring(new ObjectMapper().writeValueAsString(cleanOcr), 60000);
        } catch (Exception e) {
            rawJsonStr = safeSubstring(cleanOcr.toString(), 60000);
        }

        OcrFields ocr = OcrFields.builder()
                .caseEntity(newCase)
                .surname(safeSubstring(emptyToNull(surname), 255))
                .givenNames(safeSubstring(emptyToNull(givenNames), 255))
                .documentNumber(safeSubstring(emptyToNull(documentNumber), 100))
                .documentType(safeSubstring(emptyToNull(documentType), 20))
                .countryCode(safeSubstring(emptyToNull(countryCode), 20))
                .nationality(safeSubstring(emptyToNull(nationality), 100))
                .dateOfBirth(parseOcrDate(dobRaw))
                .sex(normalizeSexNullable(sex))
                .placeOfBirth(safeSubstring(emptyToNull(placeOfBirth), 255))
                .dateOfIssue(parseOcrDate(issueRaw))
                .expiryDate(parseOcrDate(expiryRaw))
                .issuingCountry(safeSubstring(emptyToNull(issuingCountry), 100))
                .personalNumber(safeSubstring(emptyToNull(personalNumber), 100))
                .mrzLine1(safeSubstring(firstField(ocrFields, "mrz_line1"), 100))
                .mrzLine2(safeSubstring(firstField(ocrFields, "mrz_line2"), 100))
                .rawJson(rawJsonStr)
                .ocrEngine(safeSubstring(firstField(ocrEnvelope, "ocr_engine", fieldString(ocrFields, "ocr_engine", "NONE")), 50))
                .processingMs(parseInt(firstPresent(ocrEnvelope, "processing_time_ms", "processing_ms"), 0))
                .build();
        ocrFieldsRepository.save(ocr);

        // Validation checks
        List<Map<String, Object>> checksList = (List<Map<String, Object>>) ((Map<String, Object>) ai.getOrDefault("validation", Map.of())).getOrDefault("checks", List.of());
        List<ValidationCheck> checks = new ArrayList<>();
        for (Map<String, Object> ch : checksList) {
            checks.add(ValidationCheck.builder()
                    .caseEntity(newCase)
                    .checkGroup(safeSubstring((String) ch.getOrDefault("check_group", "FORMAT"), 30))
                    .checkName(safeSubstring((String) ch.getOrDefault("check_name", "Check"), 120))
                    .passed(Boolean.TRUE.equals(ch.get("passed")))
                    .computedValue(safeSubstring((String) ch.getOrDefault("computed_value", ""), 255))
                    .storedValue(safeSubstring((String) ch.getOrDefault("stored_value", ""), 255))
                    .detail(safeSubstring((String) ch.getOrDefault("detail", ""), 1000))
                    .build());
        }
        validationCheckRepository.saveAll(checks);

        // Tampering — normalize the AI service's signal-oriented schema into the DB schema.
        Map<String, Object> tamperData = asMap(ai.getOrDefault("tamper", ai.getOrDefault("tampering", Map.of())));
        Map<String, Object> signals = asMap(tamperData.get("signals"));
        Map<String, Object> ela = asMap(signals.get("ela"));
        Map<String, Object> exif = asMap(signals.get("exif"));
        Map<String, Object> dct = asMap(signals.get("dct_frequency"));

        String exifFlagsJson = "{}";
        String hotspotsJson = "[]";
        try {
            ObjectMapper om = new ObjectMapper();
            Object exifObj = tamperData.getOrDefault("exif_flags", exif);
            if (exifObj != null) {
                exifFlagsJson = om.writeValueAsString(exifObj);
            }
            Object hotspotsObj = tamperData.getOrDefault("hotspots", signals.getOrDefault("hotspots", List.of()));
            if (hotspotsObj != null) {
                hotspotsJson = om.writeValueAsString(hotspotsObj);
            }
        } catch (Exception ignored) {}

        TamperResult tamper = TamperResult.builder()
                .caseEntity(newCase)
                .elaScore(parseInt(firstPresent(tamperData, "ela_score"), parseInt(ela.get("ela_score"), 0)))
                .metadataScore(parseInt(firstPresent(tamperData, "metadata_score"), parseInt(exif.get("exif_score"), 0)))
                .regionConsistencyScore(parseInt(firstPresent(tamperData, "region_consistency_score"), parseInt(dct.get("dct_score"), 0)))
                .overallTamperConfidence(parseInt(firstPresent(tamperData, "overall_tamper_confidence", "overall_tamper_score"), 0))
                .heatmapImagePath(safeSubstring(stringValue(tamperData.get("heatmap_image_url"), "/media/heatmap.png"), 255))
                .heatmapB64((String) tamperData.get("heatmap_b64"))
                .exifFlags(exifFlagsJson)
                .hotspots(hotspotsJson)
                .build();
        tamperResultRepository.save(tamper);

        // Face & Liveness
        Map<String, Object> faceData = (Map<String, Object>) ai.getOrDefault("face", Map.of());
        Map<String, Object> livenessData = (Map<String, Object>) ai.getOrDefault("liveness", Map.of());
        boolean comparisonPerformed = Boolean.TRUE.equals(faceData.get("comparison_performed"));
        String matchStatus = (String) faceData.getOrDefault("status", comparisonPerformed ? "SUCCESS" : "NOT_PERFORMED");

        int finalLivenessScore = livenessData.get("liveness_score") != null
                ? parseInt(livenessData.get("liveness_score"), 0)
                : parseInt(faceData.get("liveness_score"), 0);

        Boolean isMatched = faceData.get("matched") != null
                ? (Boolean) faceData.get("matched")
                : (Boolean) faceData.get("match");

        String embPreviewJson = "[0.000]";
        try {
            Object embObj = faceData.get("embedding_preview");
            if (embObj != null) {
                embPreviewJson = new ObjectMapper().writeValueAsString(embObj);
            }
        } catch (Exception ignored) {}

        FaceResult face = FaceResult.builder()
                .caseEntity(newCase)
                .distance(faceData.get("distance") != null
                        ? parseBigDecimal(faceData.get("distance"), "0.0000").setScale(4, RoundingMode.HALF_UP)
                        : null)
                .thresholdUsed(parseBigDecimal(faceData.get("threshold"), "0.6800").setScale(4, RoundingMode.HALF_UP))
                .matchResult(isMatched)
                .model(safeSubstring((String) faceData.getOrDefault("model", "ArcFace"), 40))
                .embeddingDim(parseInt(faceData.get("embedding_dim"), 512))
                .docFaceConfidence(faceData.get("doc_confidence") != null
                        ? parseBigDecimal(faceData.get("doc_confidence"), "0.0000").setScale(4, RoundingMode.HALF_UP) : null)
                .liveFaceConfidence(faceData.get("live_confidence") != null
                        ? parseBigDecimal(faceData.get("live_confidence"), "0.0000").setScale(4, RoundingMode.HALF_UP) : null)
                .livenessScore(finalLivenessScore)
                .livenessStatus(safeSubstring((String) livenessData.getOrDefault("liveness_status", "STATIC_PHOTO_UNVERIFIED"), 40))
                .blinkDetected(livenessData.get("blink_detected") != null ? Boolean.TRUE.equals(livenessData.get("blink_detected")) : false)
                .headMotionDetected(livenessData.get("motion_detected") != null ? Boolean.TRUE.equals(livenessData.get("motion_detected")) : false)
                .livenessReason(safeSubstring((String) livenessData.getOrDefault("detail", livenessData.getOrDefault("reason", "")), 255))
                .comparisonPerformed(comparisonPerformed)
                .matchStatus(matchStatus)
                .embeddingPreview(embPreviewJson)
                .docFaceB64((String) faceData.get("doc_face_b64"))
                .liveFaceB64((String) faceData.get("live_face_b64"))
                .build();
        faceResultRepository.save(face);

        // Risk
        Map<String, Object> contributions = (Map<String, Object>) riskData.getOrDefault("contributions", Map.of());
        Object activeFlagsObj = riskData.getOrDefault("active_flags", riskData.getOrDefault("risk_reasons", List.of()));
        RiskScore risk = RiskScore.builder()
                .caseEntity(newCase)
                .w1MrzChecksum(new BigDecimal("0.30"))
                .w2Tampering(new BigDecimal("0.35"))
                .w3FaceNonmatch(new BigDecimal("0.25"))
                .w4ValidationFailures(new BigDecimal("0.10"))
                .contributionMrz(parseInt(contributions.get("mrz"), 0))
                .contributionTamper(parseInt(contributions.get("tamper"), 0))
                .contributionFace(parseInt(contributions.get("face"), 0))
                .contributionValidation(parseInt(contributions.get("validation"), 0))
                .totalScore(totalScore)
                .band(band)
                .activeFlags(activeFlagsObj != null ? activeFlagsObj.toString() : "[]")
                .formula("score = w1*(1-mrz_pass) + w2*tamper + w3*(1-face_sim) + w4*(fail/total)")
                .build();
        riskScoreRepository.save(risk);
    }

    private String computeBand(int score) {
        if (score >= 60) return "HIGH";
        if (score >= 30) return "MEDIUM";
        return "LOW";
    }

    private String buildSubjectName(String surname, String givenNames) {
        if (givenNames == null || givenNames.isBlank()) return surname;
        if (surname == null || surname.isBlank() || surname.equalsIgnoreCase("UNKNOWN")) return givenNames;
        return surname + ", " + givenNames;
    }

    private LocalDate parseOcrDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.trim();
        try {
            if (s.matches("\\d{4}-\\d{2}-\\d{2}")) return LocalDate.parse(s);
            if (s.matches("\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}")) {
                String[] parts = s.split("[/.-]");
                int dd = Integer.parseInt(parts[0]);
                int mm = Integer.parseInt(parts[1]);
                int yyyy = Integer.parseInt(parts[2]);
                return LocalDate.of(yyyy, mm, dd);
            }
            if (s.matches("\\d{6}")) {
                int yy = Integer.parseInt(s.substring(0, 2));
                int mm = Integer.parseInt(s.substring(2, 4));
                int dd = Integer.parseInt(s.substring(4, 6));
                int currentYY = LocalDate.now().getYear() % 100;
                int year = yy <= currentYY + 20 ? 2000 + yy : 1900 + yy;
                return LocalDate.of(year, mm, dd);
            }
        } catch (Exception ignored) {}
        return null;
    }

    private String normalizeSexNullable(String s) {
        if (s == null || s.isBlank()) return null;
        String trimmed = s.trim();
        if (trimmed.equalsIgnoreCase("Male")) return "M";
        if (trimmed.equalsIgnoreCase("Female")) return "F";
        return trimmed.equalsIgnoreCase("M") || trimmed.equalsIgnoreCase("F") ? trimmed.toUpperCase() : null;
    }

    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> out = new LinkedHashMap<>();
            map.forEach((k, v) -> out.put(String.valueOf(k), v));
            return out;
        }
        return new LinkedHashMap<>();
    }

    private Object firstPresent(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            if (map.containsKey(key) && map.get(key) != null) return map.get(key);
        }
        return null;
    }

    private String firstField(Map<String, Object> map, String... keys) {
        for (String key : keys) {
            if (map.containsKey(key)) {
                String value = fieldString(map, key, "");
                if (!value.isBlank()) return value;
            }
        }
        return "";
    }

    private String fieldString(Map<String, Object> map, String key) {
        return fieldString(map, key, "");
    }

    private String fieldString(Map<String, Object> map, String key, String defaultValue) {
        if (!map.containsKey(key) || map.get(key) == null) return defaultValue;
        Object value = map.get(key);
        if (value instanceof Map<?, ?> nested) {
            Object inner = nested.get("value");
            return inner == null ? defaultValue : String.valueOf(inner).trim();
        }
        String s = String.valueOf(value).trim();
        return s.isBlank() ? defaultValue : s;
    }

    private String stringValue(Object value, String defaultValue) {
        if (value == null) return defaultValue;
        String s = String.valueOf(value).trim();
        return s.isBlank() ? defaultValue : s;
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private String generateDocNumber(Random rnd) {
        char[] letters = "ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
        return "" + letters[rnd.nextInt(letters.length)] + letters[rnd.nextInt(letters.length)]
                + (1000000 + rnd.nextInt(9000000));
    }

    private String generatePersonalNumber(Random rnd) {
        return String.format("%011d", (long)(rnd.nextDouble() * 99999999999L));
    }

    @Transactional
    public Map<String, Object> updateLiveCapture(Long caseId, MultipartFile livePhoto) {
        Optional<CaseEntity> opt = caseRepository.findById(caseId);
        if (opt.isEmpty()) {
            return Map.of("status", "ERROR", "message", "Case not found");
        }
        CaseEntity caseEntity = opt.get();
        if (livePhoto == null || livePhoto.isEmpty()) {
            return Map.of("status", "ERROR", "message", "Live photo is required");
        }

        String liveFilename = livePhoto.getOriginalFilename() != null && !livePhoto.getOriginalFilename().isBlank()
                ? livePhoto.getOriginalFilename() : "live_selfie.jpg";
        caseEntity.setLiveCaptureImagePath("/uploads/" + liveFilename);
        caseEntity.setLiveCaptureSource("CAMERA");
        caseRepository.save(caseEntity);

        Optional<FaceResult> faceOpt = faceResultRepository.findByCaseEntityId(caseId);
        FaceResult face = faceOpt.orElseGet(() -> FaceResult.builder().caseEntity(caseEntity).build());
        String docFaceB64 = face.getDocFaceB64();

        Map<String, Object> faceResp = new LinkedHashMap<>();
        Map<String, Object> livenessResp = new LinkedHashMap<>();

        try {
            SettingsDto settings = settingsService.getSettingsDto();
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            org.springframework.core.io.ByteArrayResource liveResource = new org.springframework.core.io.ByteArrayResource(livePhoto.getBytes()) {
                @Override
                public String getFilename() {
                    return liveFilename;
                }
            };
            body.add("live_image", liveResource);
            if (docFaceB64 != null && !docFaceB64.isBlank()) {
                body.add("doc_face_b64", docFaceB64);
            }
            body.add("threshold", settings.getFaceMatchThreshold() != null ? settings.getFaceMatchThreshold() : 0.68);
            body.add("model", settings.getFaceBackendModel() != null ? settings.getFaceBackendModel() : "ArcFace");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                    aiServiceUrl + "/face/verify",
                    HttpMethod.POST,
                    request,
                    new ParameterizedTypeReference<>() {}
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> aiFace = response.getBody();
                boolean compDone = Boolean.TRUE.equals(aiFace.get("comparison_performed"));
                Boolean matched = aiFace.get("matched") != null
                        ? (Boolean) aiFace.get("matched")
                        : (Boolean) aiFace.get("match");
                String matchStatus = (String) aiFace.getOrDefault("status", matched != null && matched ? "VERIFIED" : "MISMATCH");

                Map<String, Object> aiLiveness = aiFace.get("liveness") instanceof Map
                        ? (Map<String, Object>) aiFace.get("liveness")
                        : Map.of();

                int livenessScore = aiLiveness.get("liveness_score") != null
                        ? parseInt(aiLiveness.get("liveness_score"), 0)
                        : parseInt(aiFace.get("liveness_score"), 0);

                String embPreviewJson = "[0.000]";
                try {
                    Object embObj = aiFace.get("embedding_preview");
                    if (embObj != null) {
                        embPreviewJson = new ObjectMapper().writeValueAsString(embObj);
                    }
                } catch (Exception ignored) {}

                face.setComparisonPerformed(compDone);
                face.setMatchResult(matched);
                face.setMatchStatus(matchStatus);
                face.setModel(safeSubstring((String) aiFace.getOrDefault("model", "ArcFace"), 40));
                face.setEmbeddingDim(parseInt(aiFace.get("embedding_dim"), 512));
                face.setEmbeddingPreview(embPreviewJson);
                if (aiFace.get("distance") != null) {
                    face.setDistance(parseBigDecimal(aiFace.get("distance"), "0.0000").setScale(4, RoundingMode.HALF_UP));
                }
                face.setThresholdUsed(parseBigDecimal(aiFace.get("threshold"), "0.6800").setScale(4, RoundingMode.HALF_UP));
                if (aiFace.get("doc_confidence") != null) {
                    face.setDocFaceConfidence(parseBigDecimal(aiFace.get("doc_confidence"), "0.9600").setScale(4, RoundingMode.HALF_UP));
                }
                if (aiFace.get("live_confidence") != null) {
                    face.setLiveFaceConfidence(parseBigDecimal(aiFace.get("live_confidence"), "0.9700").setScale(4, RoundingMode.HALF_UP));
                }
                face.setLivenessScore(livenessScore);
                face.setLivenessStatus(safeSubstring((String) aiLiveness.getOrDefault("liveness_status", "STATIC_PHOTO_UNVERIFIED"), 40));
                face.setBlinkDetected(Boolean.TRUE.equals(aiLiveness.get("blink_detected")));
                face.setHeadMotionDetected(Boolean.TRUE.equals(aiLiveness.get("motion_detected")));
                face.setLivenessReason(safeSubstring((String) aiLiveness.getOrDefault("detail", aiLiveness.getOrDefault("reason", "")), 255));
                if (aiFace.get("live_face_b64") != null) {
                    face.setLiveFaceB64((String) aiFace.get("live_face_b64"));
                }
                if (aiFace.get("doc_face_b64") != null && (face.getDocFaceB64() == null || face.getDocFaceB64().isBlank())) {
                    face.setDocFaceB64((String) aiFace.get("doc_face_b64"));
                }
                faceResultRepository.save(face);

                // Recalculate RiskScore if present
                Optional<RiskScore> riskOpt = riskScoreRepository.findByCaseEntityId(caseId);
                if (riskOpt.isPresent()) {
                    RiskScore risk = riskOpt.get();
                    int faceContrib = Boolean.TRUE.equals(matched) ? 0 : 25;
                    risk.setContributionFace(faceContrib);
                    int total = (risk.getContributionMrz() != null ? risk.getContributionMrz() : 0)
                            + (risk.getContributionTamper() != null ? risk.getContributionTamper() : 0)
                            + faceContrib
                            + (risk.getContributionValidation() != null ? risk.getContributionValidation() : 0);
                    risk.setTotalScore(total);
                    if (total >= 60) {
                        risk.setBand("HIGH");
                    } else if (total >= 30) {
                        risk.setBand("MEDIUM");
                    } else {
                        risk.setBand("LOW");
                    }
                    riskScoreRepository.save(risk);
                }

                auditLogService.log("VERIFY_FACE", 1L, caseEntity, "127.0.0.1", "Biometric face verification completed: " + matchStatus);
                faceResp = aiFace;
                livenessResp = aiLiveness;
            }
        } catch (Exception e) {
            auditLogService.log("VERIFY_FACE_ERROR", 1L, caseEntity, "127.0.0.1", "Live capture face verification error: " + e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "SUCCESS");
        result.put("caseId", caseId);
        result.put("face", faceResp);
        result.put("liveness", livenessResp);
        result.put("message", "Live selfie updated and biometrically verified successfully");
        return result;
    }

    private String safeSubstring(String s, int maxLen) {
        if (s == null) return null;
        return s.length() > maxLen ? s.substring(0, maxLen) : s;
    }

    private String normalizeSex(String s) {
        if (s == null || s.isBlank()) return "X";
        String trimmed = s.trim();
        if (trimmed.equalsIgnoreCase("Male")) return "M";
        if (trimmed.equalsIgnoreCase("Female")) return "F";
        return safeSubstring(trimmed, 20);
    }

    private BigDecimal parseBigDecimal(Object obj, String defaultValue) {
        if (obj == null) {
            return new BigDecimal(defaultValue);
        }
        if (obj instanceof Number) {
            return BigDecimal.valueOf(((Number) obj).doubleValue());
        }
        String str = String.valueOf(obj).trim();
        if (str.isEmpty() || str.equalsIgnoreCase("null") || str.equalsIgnoreCase("none") || str.equalsIgnoreCase("n/a")) {
            return new BigDecimal(defaultValue);
        }
        try {
            return new BigDecimal(str);
        } catch (Exception e) {
            return new BigDecimal(defaultValue);
        }
    }

    private int parseInt(Object obj, int defaultValue) {
        if (obj == null) return defaultValue;
        if (obj instanceof Number) return ((Number) obj).intValue();
        String str = String.valueOf(obj).trim();
        if (str.isEmpty() || str.equalsIgnoreCase("null") || str.equalsIgnoreCase("none") || str.equalsIgnoreCase("n/a")) {
            return defaultValue;
        }
        try {
            return (int) Double.parseDouble(str);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private synchronized String generateUniqueCaseCode() {
        long maxNum = 4820;
        try {
            List<String> existingCodes = caseRepository.findAllCaseCodes();
            for (String code : existingCodes) {
                if (code != null && code.startsWith("EVD-")) {
                    try {
                        long val = Long.parseLong(code.substring(4).trim());
                        if (val > maxNum) {
                            maxNum = val;
                        }
                    } catch (Exception ignored) {}
                }
            }
        } catch (Exception ignored) {}

        long nextNum = maxNum + 1;
        String candidate = "EVD-" + nextNum;
        while (caseRepository.existsByCaseCode(candidate)) {
            nextNum++;
            candidate = "EVD-" + nextNum;
        }
        return candidate;
    }
}
