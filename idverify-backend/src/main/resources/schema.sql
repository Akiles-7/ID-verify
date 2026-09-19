-- Schema creation script for IDVerify MySQL database (idverify_db)

CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ROLE_OFFICER',
    designation VARCHAR(80),
    station VARCHAR(120),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cases (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_code VARCHAR(20) NOT NULL UNIQUE,
    subject_name VARCHAR(150) NOT NULL,
    document_type VARCHAR(30) NOT NULL,
    document_image_path VARCHAR(255),
    live_capture_image_path VARCHAR(255),
    live_capture_source VARCHAR(20) DEFAULT 'UPLOAD',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    risk_score TINYINT UNSIGNED DEFAULT 0,
    risk_band VARCHAR(20) DEFAULT 'LOW',
    officer_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME NULL,
    pipeline_logs LONGTEXT,
    FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ocr_fields (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    surname VARCHAR(255),
    given_names VARCHAR(255),
    document_number VARCHAR(100),
    nationality VARCHAR(100),
    date_of_birth DATE,
    sex VARCHAR(20),
    expiry_date DATE,
    issuing_country VARCHAR(100),
    personal_number VARCHAR(100),
    mrz_line1 VARCHAR(100),
    mrz_line2 VARCHAR(100),
    raw_json LONGTEXT,
    ocr_engine VARCHAR(30) DEFAULT 'PaddleOCR',
    processing_ms INT DEFAULT 0,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS validation_checks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    check_group VARCHAR(30) NOT NULL,
    check_name VARCHAR(120) NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT TRUE,
    computed_value VARCHAR(255),
    stored_value VARCHAR(255),
    detail VARCHAR(1000),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tamper_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    ela_score TINYINT UNSIGNED DEFAULT 0,
    metadata_score TINYINT UNSIGNED DEFAULT 0,
    region_consistency_score TINYINT UNSIGNED DEFAULT 0,
    overall_tamper_confidence TINYINT UNSIGNED DEFAULT 0,
    heatmap_image_path VARCHAR(255),
    heatmap_b64 LONGTEXT,
    exif_flags LONGTEXT,
    hotspots LONGTEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS face_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    distance DECIMAL(5,4),
    threshold_used DECIMAL(5,4) DEFAULT 0.4000,
    match_result BOOLEAN DEFAULT FALSE,
    model VARCHAR(40) DEFAULT 'ArcFace',
    embedding_dim SMALLINT DEFAULT 512,
    doc_face_confidence DECIMAL(4,3),
    live_face_confidence DECIMAL(4,3),
    liveness_score TINYINT UNSIGNED NULL,
    liveness_status VARCHAR(40),
    blink_detected BOOLEAN DEFAULT FALSE,
    head_motion_detected BOOLEAN DEFAULT FALSE,
    liveness_reason VARCHAR(255),
    comparison_performed BOOLEAN DEFAULT FALSE,
    match_status VARCHAR(40),
    embedding_preview LONGTEXT,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS risk_scores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NOT NULL,
    w1_mrz_checksum DECIMAL(4,2) DEFAULT 0.30,
    w2_tampering DECIMAL(4,2) DEFAULT 0.35,
    w3_face_nonmatch DECIMAL(4,2) DEFAULT 0.25,
    w4_validation_failures DECIMAL(4,2) DEFAULT 0.10,
    contribution_mrz TINYINT DEFAULT 0,
    contribution_tamper TINYINT DEFAULT 0,
    contribution_face TINYINT DEFAULT 0,
    contribution_validation TINYINT DEFAULT 0,
    total_score TINYINT UNSIGNED DEFAULT 0,
    band VARCHAR(20) DEFAULT 'LOW',
    active_flags LONGTEXT,
    formula VARCHAR(255),
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
    user_id BIGINT,
    action_type VARCHAR(40) NOT NULL,
    case_id BIGINT NULL,
    ip_address VARCHAR(45),
    detail VARCHAR(255),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    face_match_threshold DECIMAL(4,2) DEFAULT 0.40,
    face_backend_model VARCHAR(40) DEFAULT 'ARCFACE',
    ela_jpeg_quality TINYINT DEFAULT 70,
    enable_canny_edge BOOLEAN DEFAULT TRUE,
    enable_exif_scan BOOLEAN DEFAULT TRUE,
    enable_quantization_check BOOLEAN DEFAULT TRUE,
    risk_high_threshold TINYINT DEFAULT 60,
    risk_medium_threshold TINYINT DEFAULT 30,
    weight_mrz DECIMAL(4,2) DEFAULT 0.30,
    weight_tamper DECIMAL(4,2) DEFAULT 0.35,
    weight_face DECIMAL(4,2) DEFAULT 0.25,
    weight_validation DECIMAL(4,2) DEFAULT 0.10,
    enable_audit_log_sqlite BOOLEAN DEFAULT TRUE,
    auto_escalate_high_risk BOOLEAN DEFAULT TRUE,
    log_retention_days SMALLINT DEFAULT 30,
    liveness_check_enabled BOOLEAN DEFAULT TRUE,
    liveness_min_score TINYINT UNSIGNED DEFAULT 60,
    camera_frame_sample_count TINYINT DEFAULT 20,
    camera_session_timeout_seconds SMALLINT DEFAULT 300,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by BIGINT NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS live_capture_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT NULL,
    officer_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    frames_captured SMALLINT DEFAULT 0,
    blink_detected BOOLEAN DEFAULT FALSE,
    head_motion_detected BOOLEAN DEFAULT FALSE,
    liveness_score TINYINT UNSIGNED DEFAULT 0,
    final_frame_path VARCHAR(255),
    device_info VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (officer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS model_registry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    module VARCHAR(30) NOT NULL,
    model_name VARCHAR(80) NOT NULL,
    version VARCHAR(30) NOT NULL,
    framework VARCHAR(40) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    avg_latency_ms INT DEFAULT 0,
    notes VARCHAR(255),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    message VARCHAR(255) NOT NULL,
    type VARCHAR(30) DEFAULT 'ALERT',
    read_status BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
