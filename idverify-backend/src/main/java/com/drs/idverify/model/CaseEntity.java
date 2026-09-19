package com.drs.idverify.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "cases")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_code", nullable = false, unique = true, length = 20)
    private String caseCode;

    @Column(name = "subject_name", nullable = false, length = 150)
    private String subjectName;

    @Column(name = "document_type", nullable = false, length = 30)
    private String documentType; // PASSPORT, DRIVER_LICENSE, VISA, NATIONAL_ID

    @Column(name = "document_image_path")
    private String documentImagePath;

    @Column(name = "live_capture_image_path")
    private String liveCaptureImagePath;

    @Column(name = "live_capture_source", length = 20)
    private String liveCaptureSource; // UPLOAD, CAMERA

    @Column(nullable = false, length = 20)
    private String status; // PENDING, FLAGGED, CLEARED

    @Column(name = "risk_score")
    private Integer riskScore; // 0 - 100

    @Column(name = "risk_band", length = 20)
    private String riskBand; // LOW, MEDIUM, HIGH

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "officer_id")
    private User officer;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;

    @Column(name = "pipeline_logs", columnDefinition = "LONGTEXT")
    private String pipelineLogs; // JSON array of {type,text} log entries from the AI service

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (status == null) {
            status = "PENDING";
        }
        if (riskScore == null) {
            riskScore = 0;
        }
        if (riskBand == null) {
            riskBand = "LOW";
        }
    }
}
