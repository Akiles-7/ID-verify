package com.drs.idverify.service;

import com.drs.idverify.model.*;
import com.drs.idverify.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Service
public class DemoDataService {

    private final CaseRepository caseRepository;
    private final OcrFieldsRepository ocrFieldsRepository;
    private final ValidationCheckRepository validationCheckRepository;
    private final TamperResultRepository tamperResultRepository;
    private final FaceResultRepository faceResultRepository;
    private final RiskScoreRepository riskScoreRepository;
    private final UserRepository userRepository;

    public DemoDataService(CaseRepository caseRepository,
                           OcrFieldsRepository ocrFieldsRepository,
                           ValidationCheckRepository validationCheckRepository,
                           TamperResultRepository tamperResultRepository,
                           FaceResultRepository faceResultRepository,
                           RiskScoreRepository riskScoreRepository,
                           UserRepository userRepository) {
        this.caseRepository = caseRepository;
        this.ocrFieldsRepository = ocrFieldsRepository;
        this.validationCheckRepository = validationCheckRepository;
        this.tamperResultRepository = tamperResultRepository;
        this.faceResultRepository = faceResultRepository;
        this.riskScoreRepository = riskScoreRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void seedDemoData() {
        if (caseRepository.count() > 0) {
            return; // Already populated
        }

        User officer = userRepository.findByUsername("officer").orElse(null);

        // Case 1: EVD-4821
        CaseEntity c1 = CaseEntity.builder()
                .caseCode("EVD-4821")
                .subjectName("KOWALSKI, MAREK")
                .documentType("PASSPORT")
                .status("FLAGGED")
                .riskScore(74)
                .riskBand("HIGH")
                .officer(officer)
                .createdAt(LocalDateTime.now().minusHours(2))
                .build();
        c1 = caseRepository.save(c1);

        OcrFields o1 = OcrFields.builder()
                .caseEntity(c1)
                .surname("KOWALSKI")
                .givenNames("MAREK JAN")
                .documentNumber("AH4927163")
                .nationality("POL — Poland")
                .dateOfBirth(LocalDate.of(1988, 3, 15))
                .sex("M")
                .expiryDate(LocalDate.of(2028, 11, 22))
                .issuingCountry("POL")
                .personalNumber("88031504716")
                .mrzLine1("P<POLKOWALSKI<<MAREK<JAN<<<<<<<<<<<<<<<<<<<<")
                .mrzLine2("AH49271633POL8803154M2811224880315047162<<<08")
                .ocrEngine("EasyOCR")
                .processingMs(1240)
                .build();
        ocrFieldsRepository.save(o1);

        ValidationCheck v1 = ValidationCheck.builder()
                .caseEntity(c1)
                .checkGroup("CHECKSUM")
                .checkName("Passport number checksum")
                .passed(true)
                .computedValue("3")
                .storedValue("3")
                .detail("Computed: 3 · Stored: 3 ✓")
                .build();
        validationCheckRepository.save(v1);

        TamperResult t1 = TamperResult.builder()
                .caseEntity(c1)
                .elaScore(74)
                .metadataScore(88)
                .regionConsistencyScore(61)
                .overallTamperConfidence(76)
                .exifFlags("{\"software\":\"Photoshop\",\"timestamp_delta_days\":412}")
                .hotspots("[{\"label\":\"Photo boundary\",\"confidence\":92,\"bbox\":[40,30,120,140]}]")
                .build();
        tamperResultRepository.save(t1);

        FaceResult f1 = FaceResult.builder()
                .caseEntity(c1)
                .distance(new java.math.BigDecimal("0.6100"))
                .thresholdUsed(new java.math.BigDecimal("0.4000"))
                .matchResult(false)
                .model("DeepFace / ArcFace")
                .embeddingDim(512)
                .livenessScore(82)
                .build();
        faceResultRepository.save(f1);

        RiskScore r1 = RiskScore.builder()
                .caseEntity(c1)
                .w1MrzChecksum(new java.math.BigDecimal("0.30"))
                .w2Tampering(new java.math.BigDecimal("0.35"))
                .w3FaceNonmatch(new java.math.BigDecimal("0.25"))
                .w4ValidationFailures(new java.math.BigDecimal("0.10"))
                .contributionMrz(30)
                .contributionTamper(27)
                .contributionFace(15)
                .contributionValidation(2)
                .totalScore(74)
                .band("HIGH")
                .activeFlags("[\"MRZ checksum mismatch — data altered\",\"High tampering confidence\",\"Face identity mismatch\"]")
                .formula("score = w1*(1-mrz_pass) + w2*tamper + w3*(1-face_sim) + w4*(fail/total)")
                .build();
        riskScoreRepository.save(r1);

        // Case 2: EVD-4820
        CaseEntity c2 = CaseEntity.builder()
                .caseCode("EVD-4820")
                .subjectName("NGUYEN, THI LAN")
                .documentType("VISA")
                .status("CLEARED")
                .riskScore(22)
                .riskBand("LOW")
                .officer(officer)
                .createdAt(LocalDateTime.now().minusHours(3))
                .decidedAt(LocalDateTime.now().minusHours(2))
                .build();
        caseRepository.save(c2);
    }

    @Transactional
    public void clearAllCases() {
        caseRepository.deleteAll();
    }
}
