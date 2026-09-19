package com.drs.idverify.controller;

import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.service.ReportService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/scans-by-hour")
    public ResponseEntity<List<Map<String, Object>>> getScansByHour() {
        return ResponseEntity.ok(reportService.getScansByHour());
    }

    @GetMapping("/risk-distribution")
    public ResponseEntity<List<Map<String, Object>>> getRiskDistribution() {
        return ResponseEntity.ok(reportService.getRiskDistribution());
    }

    @GetMapping("/module-performance")
    public ResponseEntity<List<Map<String, Object>>> getModulePerformance() {
        return ResponseEntity.ok(reportService.getModulePerformance());
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportReport() {
        byte[] pdf = reportService.generatePdfReport();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=IDVerify_Report.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
