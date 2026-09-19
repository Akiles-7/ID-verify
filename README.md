# IDVerify — AI-Based Fake Identity & Document Screening System

**SIH 2026 Problem Statement 26188 | Team DRS**
*Theme: Cybersecurity & Blockchain*

IDVerify is a three-tier AI-powered forensic document screening console built for law enforcement, border control, and identity verification officers. The system ingests identity document scans (Passport, Driver's License, Visa, National ID), passes them through a 5-step AI forensic pipeline, and generates an explainable weighted Risk Score (0–100) with detailed visual diagnostics.

---

## 🌟 Key Features

1. **5-Step Interactive Forensic Pipeline**:
   - **Module 1 (OCR Extraction)**: PaddleOCR 3.x primary OCR with Tesseract fallback & ICAO 9303 MRZ parsing.
   - **Module 2 (Document Validation)**: ICAO 9303 §4.2.2 7-3-1 weighted modulo-10 checksum validation, date logic, and OCR character substitution checks.
   - **Module 3 (Tampering Detection)**: Error Level Analysis (ELA) heatmap overlay, EXIF metadata forensics, and Canny edge region consistency analysis.
   - **Module 4 (Face Verification)**: Pretrained DeepFace ArcFace 512-D face embedding comparison with cosine distance and embedding divergence visualizer.
   - **Module 5 (Passive Liveness Check)**: MediaPipe Face Mesh EAR blink & head-motion passive liveness detection via live webcam stream.
   - **Module 6 (Risk Scoring Engine)**: Formula-driven weighted risk score (`0–100`) with active flags, configurable thresholds, and human-in-the-loop decision buttons (`Escalate`, `Clear`, `Export PDF`).

2. **100% Database-Driven**: Served dynamically from MySQL 8.x (`idverify_db`, credentials: `root` / `rakesh@2006`). Zero hardcoded mock arrays.

3. **High-Fidelity UI Console**: Dark navy sidebar (`#0F1A33`), light canvas (`#F4F6FA`), pixel-faithful cards, gauges, charts, ELA heatmaps, and dark streaming log console matching SRS v2.0 Section 9 design tokens and UI reference screenshots.

---

## 🏗️ Architecture & Stack

- **Frontend**: React 18, Vite, Redux Toolkit, Recharts, Lucide Icons, Axios, CSS Design Tokens.
- **Core Backend**: JDK 17, Spring Boot 3.x, Spring Security (JWT HS256), Spring Data JPA, MySQL 8.x, SQLite audit sink (`case_log.db`), SSE log streaming.
- **AI Microservice**: Python 3.11, FastAPI, OpenCV, Pillow, PaddleOCR 3.x, PaddlePaddle CPU, pytesseract, DeepFace (ArcFace), MediaPipe Face Mesh, piexif.

### 🧠 The 5-Stage AI Forensics Pipeline
The Python microservice features a massively parallelized async processing pipeline via `asyncio.to_thread`.
1. **Adaptive Preprocessing**: Automatic document boundary contour detection, 4-point perspective warping, Laplacian blur detection, and image resolution normalization.
2. **Deterministic Validation**: `python-mrz` parser validates ICAO 9303 checksums, format rules, and dates. Spatial layout rules match against extracted ID patterns.
3. **Multi-Signal Tamper Detection**: Computes a fused tamper score from PNG-safe Error Level Analysis (ELA), EXIF software footprint parsing, 8x8 DCT high-frequency grid analysis, and local noise inconsistency tracking. 
4. **Biometric Identity Verification**: Uses SSD Caffe DNN face localization combined with DeepFace ArcFace 512-D ONNX embeddings. Matches the printed document photo against the live capture selfie stream.
5. **MediaPipe Passive Liveness**: Generates 468-point 3D Face Meshes from the live selfie to compute Blink EAR (Eye Aspect Ratio), Head Pose Euler angles (Yaw/Pitch), and high-frequency moiré texture anti-spoofing vectors.

---

## 🚀 Quick Start (Local Run)

### 1. Database Setup (MySQL)
Ensure MySQL is running on `localhost:3306`:
- **Database**: `idverify_db` (automatically created by Spring Boot on startup via `schema.sql` and `data.sql`).

### 2. Environment Variables (.env overrides)
You can configure the system through environment variables.
```bash
# Spring Boot (Defaults)
SPRING_DATASOURCE_URL="jdbc:mysql://localhost:3306/idverify_db?useSSL=false"
SPRING_DATASOURCE_USERNAME="root"
SPRING_DATASOURCE_PASSWORD="your-password"
JWT_SECRET="your-256-bit-minimum-secret-key"
AI_SERVICE_URL="http://localhost:8000"
```

### 3. Run Core Backend (Spring Boot)
```bash
cd idverify-backend
mvn spring-boot:run
```
*API Base*: `http://localhost:8080/api`

### 4. Run AI Microservice (FastAPI)
```bash
# Requires Python 3.11
cd idverify-ai-service
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python main.py
```
*Service Base*: `http://localhost:8000` (Warmups: OCR, MediaPipe, ArcFace load into memory on starup).

### 5. Run Frontend Console (React)
```bash
cd idverify-frontend
npm install
npm run dev
```
*Console*: `http://localhost:3000` (or `http://localhost:5173`)

---

## 🔑 Default Credentials

| Role | Username | Password | Designation / Station |
|---|---|---|---|
| **Senior Officer** | `officer` | `officer123` | J. Rodriguez · Port Auth |
| **Administrator** | `admin` | `admin123` | Lead Admin · System Control |

---

## 📄 License
Designed for Smart India Hackathon 2026 — Team DRS. All rights reserved.
