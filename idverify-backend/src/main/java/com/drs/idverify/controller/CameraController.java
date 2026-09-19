package com.drs.idverify.controller;

import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.model.LiveCaptureSession;
import com.drs.idverify.service.CameraSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/camera")
public class CameraController {

    private final CameraSessionService cameraSessionService;

    public CameraController(CameraSessionService cameraSessionService) {
        this.cameraSessionService = cameraSessionService;
    }

    @PostMapping("/session")
    public ResponseEntity<SessionDto> openSession(@RequestBody(required = false) Map<String, Object> req) {
        Long caseId = req != null && req.containsKey("caseId") ? ((Number) req.get("caseId")).longValue() : null;
        LiveCaptureSession session = cameraSessionService.openSession(caseId, 1L);
        return ResponseEntity.ok(SessionDto.builder().sessionId(session.getId()).expiresAt(session.getExpiresAt()).build());
    }

    @PostMapping("/session/{id}/frame")
    public ResponseEntity<Map<String, Object>> submitFrame(@PathVariable Long id, @RequestParam("frame") MultipartFile frame) {
        return ResponseEntity.ok(cameraSessionService.ingestFrame(id, frame));
    }

    @PostMapping("/session/{id}/finalize")
    public ResponseEntity<Map<String, Object>> finalizeSession(@PathVariable Long id) {
        return ResponseEntity.ok(cameraSessionService.finalizeSession(id));
    }
}
