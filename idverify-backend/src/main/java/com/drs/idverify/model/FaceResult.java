package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "face_results")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FaceResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private CaseEntity caseEntity;

    @Column(precision = 5, scale = 4)
    private BigDecimal distance;

    @Column(name = "threshold_used", precision = 5, scale = 4)
    private BigDecimal thresholdUsed;

    @Column(name = "match_result")
    private Boolean matchResult;

    @Column(length = 40)
    private String model;

    @Column(name = "embedding_dim")
    private Integer embeddingDim;

    @Column(name = "doc_face_confidence", precision = 4, scale = 3)
    private BigDecimal docFaceConfidence;

    @Column(name = "live_face_confidence", precision = 4, scale = 3)
    private BigDecimal liveFaceConfidence;

    @Column(name = "liveness_score")
    private Integer livenessScore;

    @Column(name = "liveness_status", length = 40)
    private String livenessStatus;

    @Column(name = "blink_detected")
    private Boolean blinkDetected;

    @Column(name = "head_motion_detected")
    private Boolean headMotionDetected;

    @Column(name = "liveness_reason", length = 255)
    private String livenessReason;

    @Column(name = "comparison_performed")
    private Boolean comparisonPerformed;

    @Column(name = "match_status", length = 40)
    private String matchStatus;

    @Column(name = "embedding_preview", columnDefinition = "LONGTEXT")
    private String embeddingPreview; // 16-element JSON array for UI bar chart

    @Column(name = "doc_face_b64", columnDefinition = "LONGTEXT")
    private String docFaceB64;

    @Column(name = "live_face_b64", columnDefinition = "LONGTEXT")
    private String liveFaceB64;
}
