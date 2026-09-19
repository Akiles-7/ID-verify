package com.drs.idverify.controller;

import com.drs.idverify.config.JwtUtil;
import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.service.CaseService;
import com.drs.idverify.service.ScanOrchestrationService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/scan")
public class ScanController {

    private final ScanOrchestrationService scanOrchestrationService;
    private final CaseService caseService;
    private final JwtUtil jwtUtil;

    public ScanController(ScanOrchestrationService scanOrchestrationService, CaseService caseService, JwtUtil jwtUtil) {
        this.scanOrchestrationService = scanOrchestrationService;
        this.caseService = caseService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> startScan(
            @RequestParam(value = "documentType", required = false, defaultValue = "PASSPORT") String documentType,
            @RequestParam(value = "documentImage", required = false) MultipartFile documentImage,
            @RequestParam(value = "liveCaptureImage", required = false) MultipartFile liveCaptureImage,
            @RequestParam(value = "aiResult", required = false) String aiResult,
            Authentication auth) {

        Long userId = 1L;
        Map<String, Object> result = scanOrchestrationService.createNewScan(documentType, documentImage, liveCaptureImage, aiResult, userId);
        if ("FAILED".equals(String.valueOf(result.get("status")))) {
            return ResponseEntity.status(502).body(result);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}/status")
    public ResponseEntity<Map<String, Object>> getStatus(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("status", "COMPLETE", "currentModule", "Module 5"));
    }

    @GetMapping("/{id}/result")
    public ResponseEntity<ScanResultDto> getResult(@PathVariable Long id) {
        return ResponseEntity.ok(caseService.getCaseDetail(id));
    }

    @PostMapping("/{id}/live-capture")
    public ResponseEntity<Map<String, Object>> uploadLiveCapture(
            @PathVariable Long id,
            @RequestParam("livePhoto") MultipartFile livePhoto) {
        Map<String, Object> result = scanOrchestrationService.updateLiveCapture(id, livePhoto);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/demo")
    public ResponseEntity<Map<String, Object>> getDemo() {
        return ResponseEntity.ok(Map.of("caseId", 1L, "caseCode", "EVD-4821", "status", "COMPLETE"));
    }
}
