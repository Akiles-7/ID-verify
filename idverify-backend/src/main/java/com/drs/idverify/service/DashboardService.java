package com.drs.idverify.service;

import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.model.*;
import com.drs.idverify.repository.*;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private final CaseRepository caseRepository;
    private final ModelRegistryRepository modelRegistryRepository;

    public DashboardService(CaseRepository caseRepository, ModelRegistryRepository modelRegistryRepository) {
        this.caseRepository = caseRepository;
        this.modelRegistryRepository = modelRegistryRepository;
    }

    public DashboardStatsDto getOverviewStats() {
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime startOfYesterday = startOfDay.minusDays(1);

        long scansToday = caseRepository.countByCreatedAtAfter(startOfDay);
        long scansYesterday = caseRepository.countByCreatedAtBetween(startOfYesterday, startOfDay);

        long highRiskFlagged = caseRepository.countByRiskBandAndCreatedAtAfter("HIGH", startOfDay);
        long highRiskYesterday = caseRepository.countByRiskBandAndCreatedAtBetween("HIGH", startOfYesterday, startOfDay);

        long cleared = caseRepository.countByStatusAndCreatedAtAfter("CLEARED", startOfDay);
        long clearedYesterday = caseRepository.countByStatusAndCreatedAtBetween("CLEARED", startOfYesterday, startOfDay);

        long pendingReview = caseRepository.countByStatusAndCreatedAtAfter("PENDING", startOfDay);
        long pendingYesterday = caseRepository.countByStatusAndCreatedAtBetween("PENDING", startOfYesterday, startOfDay);

        return DashboardStatsDto.builder()
                .scansToday(scansToday)
                .scansTodayDelta((int)(scansToday - scansYesterday))
                .highRiskFlagged(highRiskFlagged)
                .highRiskDelta((int)(highRiskFlagged - highRiskYesterday))
                .cleared(cleared)
                .clearedDelta((int)(cleared - clearedYesterday))
                .pendingReview(pendingReview)
                .pendingDelta((int)(pendingReview - pendingYesterday))
                .build();
    }

    public List<CaseSummaryDto> getRecentCases(int limit) {
        List<CaseEntity> recentCases = caseRepository.findTop6ByOrderByCreatedAtDesc();
        return recentCases.stream().map(c -> CaseSummaryDto.builder()
                .id(c.getId())
                .caseCode(c.getCaseCode())
                .subjectName(c.getSubjectName())
                .documentType(c.getDocumentType())
                .status(c.getStatus())
                .riskScore(c.getRiskScore())
                .riskBand(c.getRiskBand())
                .createdAt(c.getCreatedAt())
                .timeAgo(c.getCreatedAt() != null ? c.getCreatedAt().toLocalTime().toString().substring(0, 5) : "")
                .build()
        ).collect(Collectors.toList());
    }

    public List<ModuleHealthDto> getModuleHealth() {
        // Pull registered models from DB and report their latency as health status
        List<ModelRegistryEntry> models = modelRegistryRepository.findAll();
        if (!models.isEmpty()) {
            return models.stream()
                    .filter(ModelRegistryEntry::getIsActive)
                    .map(m -> ModuleHealthDto.builder()
                            .module(m.getModelName())
                            .status("HEALTHY")
                            .latencyMs(m.getAvgLatencyMs() != null ? m.getAvgLatencyMs().intValue() : 0)
                            .build())
                    .collect(Collectors.toList());
        }
        // If model registry is empty, return empty list (frontend will handle it)
        return Collections.emptyList();
    }
}
