package com.drs.idverify.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class Dtos {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginRequest {
        private String username;
        private String password;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserDto {
        private Long id;
        private String fullName;
        private String username;
        private String role;
        private String designation;
        private String station;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LoginResponse {
        private String token;
        private String refreshToken;
        private UserDto user;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CaseSummaryDto {
        private Long id;
        private String caseCode;
        private String subjectName;
        private String documentType;
        private String status;
        private Integer riskScore;
        private String riskBand;
        private String timeAgo;
        private LocalDateTime createdAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DashboardStatsDto {
        private long scansToday;
        private int scansTodayDelta;
        private long highRiskFlagged;
        private int highRiskDelta;
        private long cleared;
        private int clearedDelta;
        private long pendingReview;
        private int pendingDelta;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ModuleHealthDto {
        private String module;
        private String status;
        private int latencyMs;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ScanResultDto {
        private Long caseId;
        private String caseCode;
        private String subjectName;
        private String documentType;
        private String status;
        private String documentImagePath;
        private String liveCaptureImagePath;
        private Map<String, Object> ocr;
        private Map<String, Object> validation;
        private Map<String, Object> tampering;
        private Map<String, Object> face;
        private Map<String, Object> liveness;
        private Map<String, Object> risk;
        private List<Map<String, Object>> logs;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SettingsDto {
        private BigDecimal faceMatchThreshold;
        private String faceBackendModel;
        private Integer elaJpegQuality;
        private Boolean enableCannyEdge;
        private Boolean enableExifScan;
        private Boolean enableQuantizationCheck;
        private Integer riskHighThreshold;
        private Integer riskMediumThreshold;
        private BigDecimal weightMrz;
        private BigDecimal weightTamper;
        private BigDecimal weightFace;
        private BigDecimal weightValidation;
        private Boolean enableAuditLogSqlite;
        private Boolean autoEscalateHighRisk;
        private Integer logRetentionDays;
        private Boolean livenessCheckEnabled;
        private Integer livenessMinScore;
        private Integer cameraFrameSampleCount;
        private Integer cameraSessionTimeoutSeconds;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SessionDto {
        private Long sessionId;
        private LocalDateTime expiresAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class FrameAckDto {
        private int framesReceived;
        private int livenessProgress;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class LivenessResultDto {
        private int livenessScore;
        private boolean blinkDetected;
        private boolean headMotionDetected;
        private String capturedImagePath;
    }
}
