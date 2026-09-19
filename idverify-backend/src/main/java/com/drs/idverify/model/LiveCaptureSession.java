package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "live_capture_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LiveCaptureSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "officer_id")
    private Long officerId;

    @Column(nullable = false, length = 30)
    private String status; // OPEN, CAPTURED, LIVENESS_FAILED, EXPIRED

    @Column(name = "frames_captured")
    private Integer framesCaptured;

    @Column(name = "blink_detected")
    private Boolean blinkDetected;

    @Column(name = "head_motion_detected")
    private Boolean headMotionDetected;

    @Column(name = "liveness_score")
    private Integer livenessScore;

    @Column(name = "final_frame_path")
    private String finalFramePath;

    @Column(name = "device_info")
    private String deviceInfo;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (expiresAt == null) {
            expiresAt = createdAt.plusMinutes(5);
        }
        if (status == null) {
            status = "OPEN";
        }
        if (framesCaptured == null) {
            framesCaptured = 0;
        }
    }
}
