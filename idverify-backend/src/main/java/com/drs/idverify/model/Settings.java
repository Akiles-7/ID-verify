package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Settings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "face_match_threshold", precision = 4, scale = 2)
    private BigDecimal faceMatchThreshold;

    @Column(name = "face_backend_model", length = 40)
    private String faceBackendModel;

    @Column(name = "ela_jpeg_quality")
    private Integer elaJpegQuality;

    @Column(name = "enable_canny_edge")
    private Boolean enableCannyEdge;

    @Column(name = "enable_exif_scan")
    private Boolean enableExifScan;

    @Column(name = "enable_quantization_check")
    private Boolean enableQuantizationCheck;

    @Column(name = "risk_high_threshold")
    private Integer riskHighThreshold;

    @Column(name = "risk_medium_threshold")
    private Integer riskMediumThreshold;

    @Column(name = "weight_mrz", precision = 4, scale = 2)
    private BigDecimal weightMrz;

    @Column(name = "weight_tamper", precision = 4, scale = 2)
    private BigDecimal weightTamper;

    @Column(name = "weight_face", precision = 4, scale = 2)
    private BigDecimal weightFace;

    @Column(name = "weight_validation", precision = 4, scale = 2)
    private BigDecimal weightValidation;

    @Column(name = "enable_audit_log_sqlite")
    private Boolean enableAuditLogSqlite;

    @Column(name = "auto_escalate_high_risk")
    private Boolean autoEscalateHighRisk;

    @Column(name = "log_retention_days")
    private Integer logRetentionDays;

    @Column(name = "liveness_check_enabled")
    private Boolean livenessCheckEnabled;

    @Column(name = "liveness_min_score")
    private Integer livenessMinScore;

    @Column(name = "camera_frame_sample_count")
    private Integer cameraFrameSampleCount;

    @Column(name = "camera_session_timeout_seconds")
    private Integer cameraSessionTimeoutSeconds;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private User updatedBy;

    @PreUpdate
    @PrePersist
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
