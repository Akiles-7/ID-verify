package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "risk_scores")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiskScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private CaseEntity caseEntity;

    @Column(name = "w1_mrz_checksum", precision = 4, scale = 2)
    private BigDecimal w1MrzChecksum;

    @Column(name = "w2_tampering", precision = 4, scale = 2)
    private BigDecimal w2Tampering;

    @Column(name = "w3_face_nonmatch", precision = 4, scale = 2)
    private BigDecimal w3FaceNonmatch;

    @Column(name = "w4_validation_failures", precision = 4, scale = 2)
    private BigDecimal w4ValidationFailures;

    @Column(name = "contribution_mrz")
    private Integer contributionMrz;

    @Column(name = "contribution_tamper")
    private Integer contributionTamper;

    @Column(name = "contribution_face")
    private Integer contributionFace;

    @Column(name = "contribution_validation")
    private Integer contributionValidation;

    @Column(name = "total_score")
    private Integer totalScore;

    @Column(length = 20)
    private String band; // LOW, MEDIUM, HIGH

    @Column(name = "active_flags", columnDefinition = "LONGTEXT")
    private String activeFlags; // JSON array string

    @Column(length = 255)
    private String formula;
}
