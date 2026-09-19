package com.drs.idverify.controller;

import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/overview")
    public ResponseEntity<DashboardStatsDto> getOverview() {
        return ResponseEntity.ok(dashboardService.getOverviewStats());
    }

    @GetMapping("/recent-cases")
    public ResponseEntity<List<CaseSummaryDto>> getRecentCases(@RequestParam(value = "limit", defaultValue = "6") int limit) {
        return ResponseEntity.ok(dashboardService.getRecentCases(limit));
    }

    @GetMapping("/module-health")
    public ResponseEntity<List<ModuleHealthDto>> getModuleHealth() {
        return ResponseEntity.ok(dashboardService.getModuleHealth());
    }
}
