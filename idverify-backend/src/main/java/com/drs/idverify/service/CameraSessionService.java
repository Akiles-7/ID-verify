package com.drs.idverify.service;

import com.drs.idverify.model.LiveCaptureSession;
import com.drs.idverify.repository.LiveCaptureSessionRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Map;

@Service
public class CameraSessionService {

    private final LiveCaptureSessionRepository liveCaptureSessionRepository;

    public CameraSessionService(LiveCaptureSessionRepository liveCaptureSessionRepository) {
        this.liveCaptureSessionRepository = liveCaptureSessionRepository;
    }

    public LiveCaptureSession openSession(Long caseId, Long officerId) {
        LiveCaptureSession session = LiveCaptureSession.builder()
                .caseId(caseId)
                .status("OPEN")
                .framesCaptured(0)
                .blinkDetected(false)
                .headMotionDetected(false)
                .livenessScore(0)
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(5))
                .build();
        return liveCaptureSessionRepository.save(session);
    }

    public Map<String, Object> ingestFrame(Long sessionId, MultipartFile frame) {
        LiveCaptureSession session = liveCaptureSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setFramesCaptured(session.getFramesCaptured() + 1);
        liveCaptureSessionRepository.save(session);
        int progress = Math.min(100, (session.getFramesCaptured() * 100) / 20);
        return Map.of("framesReceived", session.getFramesCaptured(), "livenessProgress", progress);
    }

    public Map<String, Object> finalizeSession(Long sessionId) {
        LiveCaptureSession session = liveCaptureSessionRepository.findById(sessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));
        session.setStatus("CAPTURED");
        session.setBlinkDetected(true);
        session.setHeadMotionDetected(true);
        int livenessScore = Math.min(95, 60 + Math.min(35, session.getFramesCaptured() * 2));
        session.setLivenessScore(livenessScore);
        session.setFinalFramePath("/uploads/live_capture_" + sessionId + ".jpg");
        liveCaptureSessionRepository.save(session);

        return Map.of(
                "livenessScore", livenessScore,
                "blinkDetected", session.getBlinkDetected(),
                "headMotionDetected", session.getHeadMotionDetected(),
                "capturedImagePath", session.getFinalFramePath()
        );
    }
}
