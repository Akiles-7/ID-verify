package com.drs.idverify.service;

import com.drs.idverify.dto.Dtos.SettingsDto;
import com.drs.idverify.model.AuditLog;
import com.drs.idverify.model.Settings;
import com.drs.idverify.repository.AuditLogRepository;
import com.drs.idverify.repository.SettingsRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

@Service
public class SettingsService {

    private final SettingsRepository settingsRepository;

    public SettingsService(SettingsRepository settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    public Settings getSettings() {
        return settingsRepository.findById(1L).orElseGet(() ->
            settingsRepository.save(Settings.builder()
                .id(1L)
                .faceMatchThreshold(new BigDecimal("0.40"))
                .faceBackendModel("ARCFACE")
                .elaJpegQuality(70)
                .enableCannyEdge(true)
                .enableExifScan(true)
                .enableQuantizationCheck(true)
                .riskHighThreshold(60)
                .riskMediumThreshold(30)
                .weightMrz(new BigDecimal("0.30"))
                .weightTamper(new BigDecimal("0.35"))
                .weightFace(new BigDecimal("0.25"))
                .weightValidation(new BigDecimal("0.10"))
                .enableAuditLogSqlite(true)
                .autoEscalateHighRisk(true)
                .logRetentionDays(30)
                .livenessCheckEnabled(true)
                .livenessMinScore(60)
                .cameraFrameSampleCount(20)
                .cameraSessionTimeoutSeconds(300)
                .build())
        );
    }

    public SettingsDto getSettingsDto() {
        Settings s = getSettings();
        return SettingsDto.builder()
                .faceMatchThreshold(s.getFaceMatchThreshold())
                .faceBackendModel(s.getFaceBackendModel())
                .elaJpegQuality(s.getElaJpegQuality())
                .enableCannyEdge(s.getEnableCannyEdge())
                .enableExifScan(s.getEnableExifScan())
                .enableQuantizationCheck(s.getEnableQuantizationCheck())
                .riskHighThreshold(s.getRiskHighThreshold())
                .riskMediumThreshold(s.getRiskMediumThreshold())
                .weightMrz(s.getWeightMrz())
                .weightTamper(s.getWeightTamper())
                .weightFace(s.getWeightFace())
                .weightValidation(s.getWeightValidation())
                .enableAuditLogSqlite(s.getEnableAuditLogSqlite())
                .autoEscalateHighRisk(s.getAutoEscalateHighRisk())
                .logRetentionDays(s.getLogRetentionDays())
                .livenessCheckEnabled(s.getLivenessCheckEnabled())
                .livenessMinScore(s.getLivenessMinScore())
                .cameraFrameSampleCount(s.getCameraFrameSampleCount())
                .cameraSessionTimeoutSeconds(s.getCameraSessionTimeoutSeconds())
                .build();
    }

    public SettingsDto updateSettings(SettingsDto dto) {
        Settings s = getSettings();
        if (dto.getFaceMatchThreshold() != null) s.setFaceMatchThreshold(dto.getFaceMatchThreshold());
        if (dto.getFaceBackendModel() != null) s.setFaceBackendModel(dto.getFaceBackendModel());
        if (dto.getElaJpegQuality() != null) s.setElaJpegQuality(dto.getElaJpegQuality());
        if (dto.getEnableCannyEdge() != null) s.setEnableCannyEdge(dto.getEnableCannyEdge());
        if (dto.getEnableExifScan() != null) s.setEnableExifScan(dto.getEnableExifScan());
        if (dto.getEnableQuantizationCheck() != null) s.setEnableQuantizationCheck(dto.getEnableQuantizationCheck());
        if (dto.getRiskHighThreshold() != null) s.setRiskHighThreshold(dto.getRiskHighThreshold());
        if (dto.getRiskMediumThreshold() != null) s.setRiskMediumThreshold(dto.getRiskMediumThreshold());
        if (dto.getWeightMrz() != null) s.setWeightMrz(dto.getWeightMrz());
        if (dto.getWeightTamper() != null) s.setWeightTamper(dto.getWeightTamper());
        if (dto.getWeightFace() != null) s.setWeightFace(dto.getWeightFace());
        if (dto.getWeightValidation() != null) s.setWeightValidation(dto.getWeightValidation());
        if (dto.getEnableAuditLogSqlite() != null) s.setEnableAuditLogSqlite(dto.getEnableAuditLogSqlite());
        if (dto.getAutoEscalateHighRisk() != null) s.setAutoEscalateHighRisk(dto.getAutoEscalateHighRisk());
        if (dto.getLogRetentionDays() != null) s.setLogRetentionDays(dto.getLogRetentionDays());
        if (dto.getLivenessCheckEnabled() != null) s.setLivenessCheckEnabled(dto.getLivenessCheckEnabled());
        if (dto.getLivenessMinScore() != null) s.setLivenessMinScore(dto.getLivenessMinScore());
        if (dto.getCameraFrameSampleCount() != null) s.setCameraFrameSampleCount(dto.getCameraFrameSampleCount());
        if (dto.getCameraSessionTimeoutSeconds() != null) s.setCameraSessionTimeoutSeconds(dto.getCameraSessionTimeoutSeconds());

        settingsRepository.save(s);
        return getSettingsDto();
    }
}
