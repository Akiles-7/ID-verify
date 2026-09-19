# app/modules/tampering_and_face.py
import cv2
import numpy as np
import time
import os
import io
import base64
import logging
from PIL import Image
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("idverify.tamper_face")

from app.modules.face_utils import extract_headshot_from_document, estimate_blur, detect_face_dnn, get_face_cascade
from app.modules.liveness import evaluate_real_liveness

# 1. Biometric Face Matcher Initialization (DeepFace / ONNX ArcFace)
_deepface_available = False
try:
    from deepface import DeepFace
    _deepface_available = True
    logger.info("DeepFace module ready")
except Exception as e:
    _deepface_available = False
    logger.warning(f"DeepFace not available: {e}")

# =====================================================================
# 2. MULTI-SIGNAL FORENSIC TAMPERING DETECTION ENGINE
# =====================================================================

def analyze_ela_png_safe(image: np.ndarray, quality: int = 90) -> Dict[str, Any]:
    """
    Error Level Analysis (ELA) with PNG normalization.
    Converts lossless images (PNG) to JPEG at quality Q first before re-compressing
    to avoid false positive 100% scores on PNG uploads.
    """
    try:
        # Convert BGR to PIL RGB
        pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        
        # Step 1: Save to memory buffer at Quality Q
        buf1 = io.BytesIO()
        pil_img.save(buf1, format="JPEG", quality=quality)
        buf1.seek(0)
        im1 = Image.open(buf1)
        
        # Step 2: Re-compress at Quality Q
        buf2 = io.BytesIO()
        im1.save(buf2, format="JPEG", quality=quality)
        buf2.seek(0)
        im2 = Image.open(buf2)
        
        # Step 3: Compute absolute difference
        arr1 = np.asarray(im1, dtype=np.float32)
        arr2 = np.asarray(im2, dtype=np.float32)
        diff = np.abs(arr1 - arr2)
        
        mean_diff = float(np.mean(diff))
        max_diff = float(np.max(diff))
        
        # Calibrated ELA score (scaled 0-100)
        ela_score = float(min(100.0, max(0.0, (mean_diff / 12.0) * 100.0)))
        
        # Generate visual ELA heatmap in base64
        diff_scaled = np.clip(diff * 10.0, 0, 255).astype(np.uint8)
        heatmap_pil = Image.fromarray(diff_scaled)
        heatmap_buf = io.BytesIO()
        heatmap_pil.save(heatmap_buf, format="PNG")
        heatmap_b64 = "data:image/png;base64," + base64.b64encode(heatmap_buf.getvalue()).decode()
        
        return {
            "ela_score": round(ela_score, 2),
            "mean_pixel_diff": round(mean_diff, 2),
            "max_pixel_diff": round(max_diff, 2),
            "heatmap_b64": heatmap_b64
        }
    except Exception as e:
        return {"ela_score": 0.0, "error": str(e)}

def analyze_exif_metadata(image_bytes: bytes) -> Dict[str, Any]:
    """Parses EXIF headers for editing software tags (Photoshop, GIMP, Canva, Pixlr)."""
    suspicious_software = [
        "photoshop", "gimp", "canva", "pixlr", "paint.net", "lightroom",
        "affinity", "snapseed", "facetune", "illustrator", "coreldraw"
    ]
    detected_tools = []
    has_exif = False
    
    try:
        import piexif
        exif_dict = piexif.load(image_bytes)
        if exif_dict:
            has_exif = True
            for ifd in ("0th", "Exif", "1st"):
                for tag, val in exif_dict.get(ifd, {}).items():
                    if isinstance(val, bytes):
                        val_str = val.decode("utf-8", errors="ignore").lower()
                        for tool in suspicious_software:
                            if tool in val_str and tool not in detected_tools:
                                detected_tools.append(tool)
    except Exception:
        pass

    exif_score = 100.0 if detected_tools else (15.0 if has_exif else 0.0)
    return {
        "exif_score": exif_score,
        "has_exif": has_exif,
        "detected_tools": detected_tools
    }

def analyze_dct_frequency(image: np.ndarray) -> Dict[str, Any]:
    """8x8 Block DCT (Discrete Cosine Transform) frequency analysis to detect grid artifacts & splicing."""
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        # Process in 8x8 blocks
        h_crop = (h // 8) * 8
        w_crop = (w // 8) * 8
        cropped = gray[:h_crop, :w_crop].astype(np.float32)
        
        dct_energy = []
        for r in range(0, h_crop, 8):
            for c in range(0, w_crop, 8):
                block = cropped[r:r+8, c:c+8]
                dct_block = cv2.dct(block)
                # High frequency component sum (excluding DC component at [0,0])
                hf_energy = np.sum(np.abs(dct_block[4:, 4:]))
                dct_energy.append(hf_energy)
                
        std_energy = float(np.std(dct_energy))
        mean_energy = float(np.mean(dct_energy))
        ratio = (std_energy / (mean_energy + 1e-5))
        
        dct_score = float(min(100.0, max(0.0, (ratio - 0.5) * 60.0)))
        return {
            "dct_score": round(dct_score, 2),
            "energy_variance_ratio": round(ratio, 3)
        }
    except Exception as e:
        return {"dct_score": 0.0, "error": str(e)}

def analyze_noise_inconsistency(image: np.ndarray) -> Dict[str, Any]:
    """Computes local noise standard deviation across 16x16 blocks to spot copy-move or image splicing."""
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        h, w = gray.shape
        h_crop = (h // 16) * 16
        w_crop = (w // 16) * 16
        
        # Median filter residual (noise map)
        filtered = cv2.medianBlur(gray, 3)
        noise_map = cv2.absdiff(gray, filtered)[:h_crop, :w_crop]
        
        block_std = []
        for r in range(0, h_crop, 16):
            for c in range(0, w_crop, 16):
                blk = noise_map[r:r+16, c:c+16]
                block_std.append(np.std(blk))
                
        noise_inconsistency = float(np.std(block_std))
        noise_score = float(min(100.0, max(0.0, (noise_inconsistency - 3.0) * 15.0)))
        return {
            "noise_score": round(noise_score, 2),
            "noise_std_inconsistency": round(noise_inconsistency, 2)
        }
    except Exception as e:
        return {"noise_score": 0.0, "error": str(e)}

def analyze_tampering(img_bytes: bytes, logs: List = None) -> Dict[str, Any]:
    """
    Multi-signal forensic tampering pipeline:
    1. PNG-safe ELA (35% weight)
    2. EXIF metadata analysis (25% weight)
    3. DCT block frequency domain analysis (25% weight)
    4. Local noise variance inconsistency (15% weight)
    Note: Canny edge density is completely removed.
    """
    if logs is None:
        logs = []
        
    t0 = time.time()
    nparr = np.frombuffer(img_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return {"error": "Failed to decode image"}
        
    ela_res = analyze_ela_png_safe(image)
    exif_res = analyze_exif_metadata(img_bytes)
    dct_res = analyze_dct_frequency(image)
    noise_res = analyze_noise_inconsistency(image)
    
    s_ela = ela_res.get("ela_score", 0.0)
    s_exif = exif_res.get("exif_score", 0.0)
    s_dct = dct_res.get("dct_score", 0.0)
    s_noise = noise_res.get("noise_score", 0.0)
    
    # Weighted multi-signal formula
    overall_tamper_score = float((0.35 * s_ela) + (0.25 * s_exif) + (0.25 * s_dct) + (0.15 * s_noise))
    overall_tamper_score = round(min(100.0, max(0.0, overall_tamper_score)), 1)
    
    is_tampered = overall_tamper_score > 45.0
    
    proc_ms = int((time.time() - t0) * 1000)
    logs.append({"type": "INFO", "text": f"Forensic Tampering Analysis: score={overall_tamper_score}/100 (ELA={s_ela}, EXIF={s_exif}, DCT={s_dct}, Noise={s_noise})" })
    
    return {
        "tampering_detected": is_tampered,
        "overall_tamper_score": overall_tamper_score,
        "processing_time_ms": proc_ms,
        "signals": {
            "ela": ela_res,
            "exif": exif_res,
            "dct_frequency": dct_res,
            "noise_inconsistency": noise_res
        },
        "heatmap_b64": ela_res.get("heatmap_b64")
    }

# =====================================================================
# 3. BIOMETRIC FACE VERIFICATION ENGINE (REMOVED FAKE HISTOGRAM TIER 2)
# =====================================================================

def _extract_live_face(img: np.ndarray) -> Optional[np.ndarray]:
    """Extract a real face crop from the live selfie before biometric matching."""
    if img is None or img.size == 0:
        return None
    dnn = detect_face_dnn(img, conf_threshold=0.45)
    if dnn is not None:
        x1, y1, x2, y2, _ = dnn
        fw, fh = x2 - x1, y2 - y1
        px, py = int(fw * 0.25), int(fh * 0.30)
        return img[max(0, y1-py):min(img.shape[0], y2+py), max(0, x1-px):min(img.shape[1], x2+px)]

    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        cascade = get_face_cascade()
        if cascade is not None:
            faces = cascade.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=5, minSize=(80, 80))
            if len(faces):
                fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                px, py = int(fw * 0.25), int(fh * 0.30)
                return img[max(0, fy-py):min(img.shape[0], fy+fh+py), max(0, fx-px):min(img.shape[1], fx+fw+px)]
    except Exception:
        pass
    return None


def verify_face(doc_img_bytes: bytes, live_img_bytes: bytes, logs: List = None, threshold: float = 0.40) -> Dict[str, Any]:
    """Compare the printed document portrait against a detected live face using ArcFace."""
    if logs is None:
        logs = []

    t0 = time.time()
    doc_img = cv2.imdecode(np.frombuffer(doc_img_bytes, np.uint8), cv2.IMREAD_COLOR)
    live_img = cv2.imdecode(np.frombuffer(live_img_bytes, np.uint8), cv2.IMREAD_COLOR)
    if doc_img is None or live_img is None:
        return {"matched": False, "status": "IMAGE_DECODE_FAILED", "similarity_score": 0.0, "distance": 1.0, "comparison_performed": False, "detail": "Failed to decode input images"}

    headshot = extract_headshot_from_document(doc_img, logs)
    live_face = _extract_live_face(live_img)
    if headshot is None or live_face is None:
        logs.append({"type": "WARN", "text": "Face Matcher: face could not be detected in document or live capture"})
        return {"matched": False, "status": "FACE_NOT_DETECTED", "similarity_score": 0.0, "distance": 1.0, "comparison_performed": False, "model": "ArcFace", "threshold": threshold, "detail": "A usable face was not detected in both images"}

    # ArcFace expects a reasonably sized aligned face crop. Upscaling does not
    # create detail, but it prevents tiny Haar detections from being rejected by
    # downstream model input validation.
    if min(headshot.shape[:2]) < 160:
        scale = 160.0 / min(headshot.shape[:2])
        headshot = cv2.resize(headshot, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    if min(live_face.shape[:2]) < 160:
        scale = 160.0 / min(live_face.shape[:2])
        live_face = cv2.resize(live_face, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    sharp_doc = estimate_blur(headshot)
    sharp_live = estimate_blur(live_face)
    if sharp_doc < 25.0 or sharp_live < 25.0:
        return {"matched": False, "status": "LOW_FACE_QUALITY", "similarity_score": 0.0, "distance": 1.0, "comparison_performed": False, "model": "ArcFace", "threshold": threshold, "detail": f"Face quality too low (doc={sharp_doc:.1f}, live={sharp_live:.1f})"}

    if not _deepface_available:
        return {"matched": False, "status": "FACE_ENGINE_UNAVAILABLE", "similarity_score": 0.0, "distance": 1.0, "comparison_performed": False, "model": "ArcFace", "threshold": threshold, "detail": "DeepFace/ArcFace is not installed"}

    import tempfile
    doc_path = live_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            doc_path = f.name
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            live_path = f.name
        cv2.imwrite(doc_path, headshot)
        cv2.imwrite(live_path, live_face)

        res = DeepFace.verify(
            img1_path=doc_path,
            img2_path=live_path,
            model_name="ArcFace",
            distance_metric="cosine",
            detector_backend="skip",
            enforce_detection=False,
        )
        dist = float(res.get("distance", 1.0))
        is_match = bool(dist <= float(threshold))
        similarity = round(max(0.0, min(100.0, (1.0 - dist) * 100.0)), 1)
        proc_ms = int((time.time() - t0) * 1000)
        logs.append({"type": "INFO", "text": f"Biometric Face Verification (ArcFace): match={is_match}, dist={dist:.4f}, threshold={threshold:.4f}, similarity={similarity}%"})
        return {
            "matched": is_match,
            "status": "VERIFIED" if is_match else "MISMATCH",
            "similarity_score": similarity,
            "distance": round(dist, 4),
            "threshold": float(threshold),
            "model": "ArcFace",
            "model_used": "ArcFace",
            "embedding_dim": 512,
            "comparison_performed": True,
            "processing_time_ms": proc_ms,
            "detail": "ArcFace cosine distance comparison completed on detected face crops",
        }
    except Exception as ex:
        logger.warning("DeepFace ArcFace verification error: %s", ex)
        logs.append({"type": "WARN", "text": f"DeepFace ArcFace verification error: {ex}"})
        return {"matched": False, "status": "FACE_VERIFICATION_ERROR", "similarity_score": 0.0, "distance": 1.0, "comparison_performed": False, "model": "ArcFace", "threshold": threshold, "detail": str(ex)[:500]}
    finally:
        for path in (doc_path, live_path):
            if path:
                try:
                    os.remove(path)
                except OSError:
                    pass

def compute_risk_score(ocr_res: Dict, val_res: Dict, tamp_res: Dict, face_res: Dict, liveness_res: Dict = None, logs: List = None) -> Dict[str, Any]:
    """Compute a deterministic, explainable 0-100 risk score."""
    if logs is None:
        logs = []

    # Component weights sum to 100 points.
    contributions = {"mrz": 0, "tamper": 0, "face": 0, "validation": 0, "liveness": 0}
    reasons: List[str] = []

    val_passed = bool(val_res.get("valid", False))
    failed_count = max(0, int(val_res.get("total_count", 0)) - int(val_res.get("passed_count", 0)))
    if not val_passed and failed_count:
        contributions["validation"] = min(20, failed_count * 4)
        reasons.append(f"{failed_count} document validation check(s) failed")

    mrz_valid = bool(ocr_res.get("mrz_result", {}).get("valid", False))
    if not mrz_valid:
        contributions["mrz"] = 30
        reasons.append("MRZ could not be fully validated")

    tamper_score = float(tamp_res.get("overall_tamper_score", 0.0) or 0.0)
    contributions["tamper"] = min(25, int(round(tamper_score * 0.25)))
    if tamper_score >= 45:
        reasons.append(f"Forensic tampering indicator is elevated ({tamper_score:.1f}/100)")

    face_status = str(face_res.get("status", "FACE_NOT_DETECTED"))
    face_matched = bool(face_res.get("matched", False))
    if face_status == "MISMATCH":
        contributions["face"] = 20
        reasons.append("Face biometric mismatch between document and live capture")
    elif not face_matched:
        contributions["face"] = 15
        reasons.append(f"Face verification incomplete ({face_status})")

    if liveness_res is not None and not bool(liveness_res.get("liveness_passed", False)):
        contributions["liveness"] = 15
        reasons.append(f"Liveness check failed ({liveness_res.get('liveness_status', 'UNKNOWN')})")

    total_score = min(100, sum(contributions.values()))
    if total_score >= 70:
        level, action = "CRITICAL", "REJECT"
    elif total_score >= 45:
        level, action = "HIGH", "MANUAL_REVIEW"
    elif total_score >= 20:
        level, action = "MEDIUM", "MANUAL_REVIEW"
    else:
        level, action = "LOW", "APPROVE"

    logs.append({"type": "INFO", "text": f"Risk Engine: final_score={total_score}/100 level={level} action={action}"})

    return {
        "risk_score": total_score,
        "total_score": total_score,
        "risk_level": level,
        "band": level,
        "recommendation": action,
        "risk_reasons": reasons,
        "active_flags": reasons,
        "contributions": contributions,
        "summary": f"Document evaluated with {level} risk ({total_score}/100)",
    }
