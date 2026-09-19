-- Initial seed script for IDVerify MySQL database (idverify_db)

-- Insert Users (Passwords hashed with BCrypt strength 10: 'officer123' and 'admin123')
INSERT IGNORE INTO users (id, full_name, username, password_hash, role, designation, station) VALUES
(1, 'J. Rodriguez', 'officer', '$2a$10$8.UnVuG9HHgffUDAlk8qfOUVGkqRzgV6569y88N3c0x3213.G377W', 'ROLE_OFFICER', 'Senior Officer', 'Port Authority Terminal 3'),
(2, 'System Administrator', 'admin', '$2a$10$8.UnVuG9HHgffUDAlk8qfOUVGkqRzgV6569y88N3c0x3213.G377W', 'ROLE_ADMIN', 'Lead Admin', 'System Control');

-- Insert Settings
INSERT IGNORE INTO settings (id, face_match_threshold, face_backend_model, ela_jpeg_quality, enable_canny_edge, enable_exif_scan, enable_quantization_check, risk_high_threshold, risk_medium_threshold, weight_mrz, weight_tamper, weight_face, weight_validation, enable_audit_log_sqlite, auto_escalate_high_risk, log_retention_days, liveness_check_enabled, liveness_min_score, camera_frame_sample_count, camera_session_timeout_seconds, updated_by) VALUES
(1, 0.40, 'ARCFACE', 70, TRUE, TRUE, TRUE, 60, 30, 0.30, 0.35, 0.25, 0.10, TRUE, TRUE, 30, TRUE, 60, 20, 300, 2);

-- Insert Model Registry
INSERT IGNORE INTO model_registry (id, module, model_name, version, framework, is_active, avg_latency_ms, notes) VALUES
(1, 'OCR', 'PaddleOCR PP-OCRv6 (en)', '3.x', 'PaddlePaddle', TRUE, 0, 'Primary OCR engine; Tesseract fallback'),
(2, 'TAMPER', 'Classical CV (ELA + EXIF + Canny)', '2.4.0', 'OpenCV / Pillow', TRUE, 2870, 'Forensic tampering analysis'),
(3, 'FACE', 'ArcFace (DeepFace backend)', 'deepface==0.0.93', 'TensorFlow', TRUE, 1530, '512-D face embedding matcher'),
(4, 'LIVENESS', 'MediaPipe Face Mesh', '0.10.14', 'MediaPipe', TRUE, 80, 'Passive EAR blink & head motion tracker');
