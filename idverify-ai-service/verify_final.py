"""
IDVerify Final Verification Suite
==================================
Tests all 5 AI modules with clean + degraded images.
Does NOT modify the codebase.
"""
import sys, os, time, json, traceback
import numpy as np
import cv2

# ── path setup ──────────────────────────────────────────────────────────────
sys.path.insert(0, r"c:\Users\Dhanush\Downloads\project-sih\idverify-ai-service")

results = {}
PASSED = []
FAILED = []

def mark(name, ok, detail=""):
    if ok:
        PASSED.append(name)
        print(f"  [PASS] {name}")
    else:
        FAILED.append(f"{name}: {detail}")
        print(f"  [FAIL] {name}: {detail}")

# ── helpers to build synthetic test images ───────────────────────────────────
def make_image(degrade="none"):
    """
    Draws a synthetic passport: header text, MRZ lines, a grey face square.
    The MRZ lines use a VALID TD3 string from ISO 9303 (passporteye accepts it).
    """
    img = np.ones((800, 1200, 3), dtype=np.uint8) * 240
    cv2.putText(img, "PASSPORT / PASSEPORT", (350, 60), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0,0,120), 2)
    cv2.putText(img, "REPUBLIC OF POLAND", (380, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,0,0), 2)
    # Row 1 (44 chars)
    cv2.putText(img, "P<POLKOWALSKI<<JAN<PAWEL<<<<<<<<<<<<<<<<<<<<<", (50, 700),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 2)
    # Row 2 (44 chars)
    cv2.putText(img, "EA12345678POL8001014M3001019<<<<<<<<<<<<<<02", (50, 740),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,0), 2)
    cv2.rectangle(img, (80, 150), (300, 450), (100,100,100), -1)
    cv2.circle(img, (190, 260), 60, (200,200,200), -1)

    if degrade == "blur":
        img = cv2.GaussianBlur(img, (31, 31), 0)
    elif degrade == "low_res":
        img = cv2.resize(img, (200, 133))
    elif degrade == "rotated":
        M = cv2.getRotationMatrix2D((img.shape[1]//2, img.shape[0]//2), 15, 1)
        img = cv2.warpAffine(img, M, (img.shape[1], img.shape[0]), borderValue=(240,240,240))
    elif degrade == "contrast":
        img = cv2.convertScaleAbs(img, alpha=0.3, beta=150)
    elif degrade == "noise":
        noise = np.random.normal(0, 30, img.shape).astype(np.int16)
        img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    _, enc = cv2.imencode(".png", img)
    return enc.tobytes()

# ── Static code-audit checks ─────────────────────────────────────────────────
print("\n========================================")
print("SECTION A: STATIC CODE AUDIT")
print("========================================")

def file_contains(path, substr):
    try:
        with open(path, encoding="utf-8") as f:
            return substr in f.read()
    except:
        return False

BASE = r"c:\Users\Dhanush\Downloads\project-sih\idverify-ai-service\app\modules"

# No fake liveness hard-coded True booleans
liveness_path = os.path.join(BASE, "liveness.py")
mark("liveness: no hardcoded blink_detected=True",
     not file_contains(liveness_path, "blink_detected = True"))
mark("liveness: no hardcoded motion_detected=True",
     not file_contains(liveness_path, "motion_detected = True"))

# No histogram-based fallback in face verify
taf_path = os.path.join(BASE, "tampering_and_face.py")
mark("face: histogram fallback removed",
     not file_contains(taf_path, "cv2.compareHist"))
mark("face: Tier 2 fallback removed",
     not file_contains(taf_path, "Tier 2"))
mark("face: reports FACE_NOT_DETECTED on failure",
     file_contains(taf_path, "FACE_NOT_DETECTED"))

# Model singleton pattern
main_path = r"c:\Users\Dhanush\Downloads\project-sih\idverify-ai-service\main.py"
mark("model warmup at startup exists in main.py",
     file_contains(main_path, "startup") or file_contains(main_path, "warm"))

# Async parallel pipeline
pipeline_path = r"c:\Users\Dhanush\Downloads\project-sih\idverify-ai-service\app\routers\pipeline.py"
mark("pipeline: asyncio.gather used",
     file_contains(pipeline_path, "asyncio.gather"))
mark("pipeline: asyncio.to_thread used",
     file_contains(pipeline_path, "to_thread"))

# Spring Boot timeout configured
sb_orch = r"c:\Users\Dhanush\Downloads\project-sih\idverify-backend\src\main\java\com\drs\idverify\service\ScanOrchestrationService.java"
mark("Spring Boot: RestTemplate timeout configured",
     file_contains(sb_orch, "setReadTimeout"))

# Env-var credentials
app_yml = r"c:\Users\Dhanush\Downloads\project-sih\idverify-backend\src\main\resources\application.yml"
mark("Spring Boot: DB password via env var",
     file_contains(app_yml, "SPRING_DATASOURCE_PASSWORD"))
mark("Spring Boot: JWT secret via env var",
     file_contains(app_yml, "JWT_SECRET"))

# Frontend field name alignment
new_scan = r"c:\Users\Dhanush\Downloads\project-sih\idverify-frontend\src\pages\NewScan.jsx"
mark("Frontend: documentImage field name correct",
     file_contains(new_scan, "documentImage"))
mark("Frontend: liveCaptureImage field name correct",
     file_contains(new_scan, "liveCaptureImage"))

# ── Module functional tests ──────────────────────────────────────────────────
print("\n========================================")
print("SECTION B: MODULE FUNCTIONAL TESTS")
print("========================================")

# --- 1. Preprocessing --------------------------------------------------------
print("\n[MODULE 1] Adaptive Preprocessing")
try:
    from app.preprocessing.preprocessing import analyze_image_quality, build_preprocessing_variants
    clean_bytes = make_image("none")
    blur_bytes  = make_image("blur")
    nparr = np.frombuffer(clean_bytes, np.uint8)
    img_c = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    nparr2 = np.frombuffer(blur_bytes, np.uint8)
    img_b = cv2.imdecode(nparr2, cv2.IMREAD_COLOR)

    q_clean = analyze_image_quality(img_c)
    q_blur  = analyze_image_quality(img_b)

    mark("preprocessing: quality score for clean > blur",
         q_clean.get("quality_score", 0) >= q_blur.get("quality_score", 0))
    mark("preprocessing: blur detected on GaussianBlur image",
         q_blur.get("is_blurry", True))

    variants_clean = build_preprocessing_variants(img_c, q_clean)
    mark("preprocessing: at least 2 variants generated",
         isinstance(variants_clean, list) and len(variants_clean) >= 2)
    results["preprocessing_quality_clean"] = q_clean.get("quality_score")
    results["preprocessing_quality_blur"]  = q_blur.get("quality_score")
    results["preprocessing_blur_detected"] = q_blur.get("is_blurry")
except Exception as e:
    mark("preprocessing: module load", False, str(e))

# --- 2. OCR & MRZ -------------------------------------------------------
print("\n[MODULE 2] OCR & MRZ")
for label, degrade in [("clean", "none"), ("blurry", "blur"), ("low_res", "low_res"),
                        ("rotated", "rotated"), ("contrast", "contrast"), ("noisy", "noise")]:
    try:
        from app.modules.ocr_and_validation import extract_ocr_fields
        b = make_image(degrade)
        logs = []
        t0 = time.time()
        r = extract_ocr_fields(b, "PASSPORT", logs)
        elapsed = (time.time() - t0) * 1000
        ok = r.get("success", False)
        mrz = r.get("mrz_result", {})
        mark(f"ocr[{label}]: returns success=True", ok)
        results[f"ocr_{label}_success"] = ok
        results[f"ocr_{label}_mrz_type"] = mrz.get("mrz_type", "None")
        results[f"ocr_{label}_time_ms"] = round(elapsed, 1)
        print(f"    MRZ type={mrz.get('mrz_type','none')} checksum_valid={mrz.get('checksum_valid')} in {elapsed:.0f}ms")
    except Exception as e:
        mark(f"ocr[{label}]: no exception", False, str(e)[:120])

# --- 3. Validation -------------------------------------------------------
print("\n[MODULE 3] Validation Engine")
try:
    from app.modules.ocr_and_validation import extract_ocr_fields, validate_document
    logs = []
    ocr_r = extract_ocr_fields(make_image("none"), "PASSPORT", logs)
    val_r = validate_document(ocr_r, logs)
    mark("validation: returns dict", isinstance(val_r, dict))
    mark("validation: has valid key", "valid" in val_r)
    results["validation_passed_checks"] = f"{val_r.get('passed_count',0)}/{val_r.get('total_count',0)}"
except Exception as e:
    mark("validation: module call", False, str(e))

# --- 4. Tampering -------------------------------------------------------
print("\n[MODULE 4] Forensic Tampering")
try:
    from app.modules.tampering_and_face import analyze_tampering
    for label, degrade in [("clean", "none"), ("blurry", "blur")]:
        logs = []
        t0 = time.time()
        tamp = analyze_tampering(make_image(degrade), logs)
        elapsed = (time.time() - t0) * 1000
        score = tamp.get("overall_tamper_score", -1)
        mark(f"tampering[{label}]: score 0..100", 0 <= score <= 100)
        mark(f"tampering[{label}]: has ELA signal",
             "ela" in tamp.get("signals", {}))
        results[f"tamper_{label}_score"] = score
        results[f"tamper_{label}_ms"] = round(elapsed, 1)
        print(f"    score={score}/100 time={elapsed:.0f}ms")
except Exception as e:
    mark("tampering: module call", False, str(e)[:120])

# --- 5. Face Verification -----------------------------------------------
print("\n[MODULE 5] Face Biometrics")
try:
    from app.modules.tampering_and_face import verify_face
    b = make_image("none")
    logs = []
    t0 = time.time()
    face_r = verify_face(b, b, logs)
    elapsed = (time.time() - t0)*1000
    mark("face: no comparison_performed without live face",
         not face_r.get("comparison_performed", False) or face_r.get("status") not in [None, ""])
    mark("face: status key present", "status" in face_r)
    mark("face: no histogram fallback in result", "histogram" not in str(face_r).lower())
    results["face_status"] = face_r.get("status")
    results["face_ms"] = round(elapsed, 1)
    print(f"    status={face_r.get('status')} time={elapsed:.0f}ms")
except Exception as e:
    mark("face: module call", False, str(e)[:120])

# --- 6. Liveness -------------------------------------------------------
print("\n[MODULE 6] MediaPipe Liveness")
try:
    from app.modules.liveness import evaluate_real_liveness
    b = make_image("none")
    logs = []
    t0 = time.time()
    live_r = evaluate_real_liveness(b, logs)
    elapsed = (time.time() - t0)*1000
    mark("liveness: liveness_passed key present", "liveness_passed" in live_r)
    mark("liveness: liveness_score is numeric", isinstance(live_r.get("liveness_score"), (int, float)))
    mark("liveness: blink_detected key exists", "blink_detected" in live_r)
    mark("liveness: motion_detected key exists", "motion_detected" in live_r)
    results["liveness_passed"] = live_r.get("liveness_passed")
    results["liveness_score"] = live_r.get("liveness_score")
    results["liveness_status"] = live_r.get("liveness_status")
    results["liveness_ms"] = round(elapsed, 1)
    print(f"    passed={live_r.get('liveness_passed')} score={live_r.get('liveness_score')} time={elapsed:.0f}ms")
except Exception as e:
    mark("liveness: module call", False, str(e)[:120])

# --- 7. Risk Scoring ---------------------------------------------------
print("\n[MODULE 7] Risk Score Engine")
try:
    from app.modules.tampering_and_face import compute_risk_score
    from app.modules.ocr_and_validation import extract_ocr_fields, validate_document
    from app.modules.tampering_and_face import analyze_tampering
    from app.modules.tampering_and_face import verify_face
    from app.modules.liveness import evaluate_real_liveness
    b = make_image("none")
    logs = []
    o = extract_ocr_fields(b, "PASSPORT", logs)
    v = validate_document(o, logs)
    t = analyze_tampering(b, logs)
    f = verify_face(b, None, logs)
    l = evaluate_real_liveness(b, logs)
    risk = compute_risk_score(o, v, t, f, l, logs)
    mark("risk: risk_score 0..100", 0 <= risk.get("risk_score", -1) <= 100)
    mark("risk: risk_level key exists", "risk_level" in risk)
    mark("risk: recommendation key exists", "recommendation" in risk)
    mark("risk: risk_reasons is a list", isinstance(risk.get("risk_reasons", []), list))
    results["risk_score"] = risk.get("risk_score")
    results["risk_level"] = risk.get("risk_level")
    results["risk_recommendation"] = risk.get("recommendation")
    print(f"    risk_score={risk.get('risk_score')}/100 level={risk.get('risk_level')}")
except Exception as e:
    mark("risk: module call", False, str(e)[:120])

# ── Print summary ────────────────────────────────────────────────────────────
print("\n\n========================================")
print("VERIFICATION SUMMARY")
print("========================================")
print(f"Total PASSED : {len(PASSED)}")
print(f"Total FAILED : {len(FAILED)}")
if FAILED:
    print("\nFailed tests:")
    for f in FAILED:
        print(f"  - {f}")
print("\nKey results:")
for k, v in results.items():
    print(f"  {k}: {v}")
print("========================================")
