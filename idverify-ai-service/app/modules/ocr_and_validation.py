# app/modules/ocr_and_validation.py
import cv2
import numpy as np
import time
import re
import base64
import os
import logging
import shutil
from PIL import Image
import io
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("idverify.ocr")

# 1. Imports from submodules
from app.preprocessing.preprocessing import analyze_image_quality, build_preprocessing_variants, deskew_image
from app.modules.mrz_parser import parse_mrz_text
from app.modules.national_id_validators import is_valid_aadhaar_checksum, build_ocr_failure_checks
from app.modules.face_utils import crop_face_b64_from_doc, extract_headshot_from_document

# 2. Warm Singleton OCR Engine Initialization
#
# PaddleOCR 3.x is the preferred local OCR engine.  Tesseract is retained as a
# deterministic fallback because the application must remain usable when the
# optional Paddle runtime is not installed yet.
_paddle_ocr = None
_paddle_init_error = None
_paddle_api = None
try:
    from paddleocr import PaddleOCR
    try:
        # PaddleOCR 3.x API (PP-OCRv6 by default).
        _paddle_ocr = PaddleOCR(
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            lang="en",
            engine="paddle",
            device="cpu",
            enable_mkldnn=False,
        )
        _paddle_api = "v3"
    except TypeError:
        # Compatibility with older 2.x installations.
        _paddle_ocr = PaddleOCR(use_angle_cls=True, lang="en", enable_mkldnn=False)
        _paddle_api = "legacy"
    logger.info("PaddleOCR primary singleton initialized successfully (%s)", _paddle_api)
except Exception as e:
    _paddle_init_error = str(e)
    logger.warning("PaddleOCR primary engine unavailable: %s", e)

_tesseract_available = False
pytesseract = None
try:
    import pytesseract
    _tess_probe_paths = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        r"C:\Tesseract-OCR\tesseract.exe",
    ]
    for _tess_path in _tess_probe_paths:
        if os.path.exists(_tess_path):
            pytesseract.pytesseract.tesseract_cmd = _tess_path
            break
    _tesseract_available = shutil.which("tesseract") is not None or os.path.exists(
        pytesseract.pytesseract.tesseract_cmd
    )
except Exception as e:
    logger.warning("Tesseract probe failed: %s", e)

def get_ocr_engine_status() -> dict:
    if _paddle_ocr is not None:
        active_engine = "PaddleOCR"
        model = "PP-OCRv6"
    elif _tesseract_available:
        active_engine = "Tesseract"
        model = "Tesseract"
    else:
        active_engine = "NONE"
        model = "NONE"
    return {
        "primary_ocr_engine": active_engine,
        "paddleocr_available": _paddle_ocr is not None,
        "paddleocr_error": _paddle_init_error,
        "tesseract_available": _tesseract_available,
        "device": "CPU",
        "model": model,
        "status": "READY" if active_engine != "NONE" else "DEGRADED",
    }


def _paddle_result_payload(result):
    """Best-effort extraction of the PaddleOCR 3.x Result object payload."""
    if result is None:
        return None
    try:
        payload = getattr(result, "json", None)
        if callable(payload):
            payload = payload()
        if payload is not None:
            if isinstance(payload, dict) and "res" in payload:
                return payload["res"]
            return payload
    except Exception:
        pass
    try:
        if isinstance(result, dict):
            return result.get("res", result)
    except Exception:
        pass
    return None


def _run_paddle(img: np.ndarray) -> List[Dict[str, Any]]:
    if _paddle_ocr is None:
        return []
    results = _paddle_ocr.predict(img) if _paddle_api == "v3" else _paddle_ocr.ocr(img, cls=True)
    blocks: List[Dict[str, Any]] = []

    if _paddle_api == "v3":
        for result in results or []:
            payload = _paddle_result_payload(result)
            if not isinstance(payload, dict):
                continue
            texts = payload.get("rec_texts") or []
            scores = payload.get("rec_scores") or []
            polys = payload.get("rec_polys") or payload.get("dt_polys") or []
            for idx, txt in enumerate(texts):
                txt = str(txt).strip()
                if not txt:
                    continue
                conf = float(scores[idx]) if idx < len(scores) else 0.0
                box = polys[idx].tolist() if idx < len(polys) and hasattr(polys[idx], "tolist") else (polys[idx] if idx < len(polys) else [])
                if not box:
                    continue
                xs = [float(pt[0]) for pt in box]
                ys = [float(pt[1]) for pt in box]
                blocks.append({
                    "box": box,
                    "x": min(xs),
                    "y": sum(ys) / len(ys),
                    "text": txt,
                    "confidence": max(0.0, min(1.0, conf)),
                    "engine": "PaddleOCR",
                })
        return blocks

    # PaddleOCR 2.x result format.
    for line in results or []:
        if not line:
            continue
        for item in line:
            if not item or len(item) < 2:
                continue
            box = item[0]
            info = item[1]
            txt = str(info[0]).strip() if len(info) > 0 else ""
            conf = float(info[1]) if len(info) > 1 else 0.0
            if not txt:
                continue
            xs = [float(pt[0]) for pt in box]
            ys = [float(pt[1]) for pt in box]
            blocks.append({
                "box": box,
                "x": min(xs),
                "y": sum(ys) / len(ys),
                "text": txt,
                "confidence": max(0.0, min(1.0, conf)),
                "engine": "PaddleOCR",
            })
    return blocks


def _run_tesseract(img: np.ndarray, psm: int = 6) -> List[Dict[str, Any]]:
    if pytesseract is None or not _tesseract_available:
        return []
    data = pytesseract.image_to_data(
        img,
        output_type=pytesseract.Output.DICT,
        config=f"--oem 3 --psm {psm}",
    )
    blocks: List[Dict[str, Any]] = []
    for i, raw_txt in enumerate(data.get("text", [])):
        txt = str(raw_txt).strip()
        if not txt:
            continue
        try:
            conf = float(data["conf"][i]) / 100.0
        except Exception:
            conf = 0.0
        if conf < 0.05:
            continue
        x, y, w, h = (int(data["left"][i]), int(data["top"][i]), int(data["width"][i]), int(data["height"][i]))
        blocks.append({
            "box": [[x, y], [x+w, y], [x+w, y+h], [x, y+h]],
            "x": float(x),
            "y": float(y + h / 2.0),
            "text": txt,
            "confidence": max(0.0, min(1.0, conf)),
            "engine": "Tesseract",
        })
    return blocks


def run_ocr_on_variant(img: np.ndarray, tesseract_psm: int = 6) -> List[Dict[str, Any]]:
    """Run the configured OCR engine. Never silently labels fallback output as PaddleOCR."""
    if _paddle_ocr is not None:
        try:
            blocks = _run_paddle(img)
            if blocks:
                return blocks
        except Exception as e:
            logger.warning("PaddleOCR pass error: %s", e)
    if _tesseract_available:
        try:
            return _run_tesseract(img, psm=tesseract_psm)
        except Exception as e:
            logger.warning("Tesseract pass error: %s", e)
    return []


def _ocr_quality(blocks: List[Dict[str, Any]]) -> float:
    if not blocks:
        return 0.0
    confidences = [float(b.get("confidence", 0.0)) for b in blocks]
    mean_conf = float(np.mean(confidences))
    # Confidence matters more than block count; a page full of low-confidence
    # garbage must not be accepted merely because it contains many boxes.
    coverage = min(1.0, len(blocks) / 12.0)
    return (0.85 * mean_conf) + (0.15 * coverage)


def extract_mrz_lines_from_blocks(blocks: List[Dict[str, Any]]) -> List[str]:
    """Finds MRZ lines from spatial text blocks."""
    mrz_candidates = []
    # Sort blocks by y coordinate ascending
    sorted_blocks = sorted(blocks, key=lambda b: b["y"])
    
    # Group into spatial rows
    rows = []
    if sorted_blocks:
        active_row = [sorted_blocks[0]]
        for b in sorted_blocks[1:]:
            if abs(b["y"] - active_row[-1]["y"]) < 20.0:
                active_row.append(b)
            else:
                active_row.sort(key=lambda s: s["x"])
                rows.append(active_row)
                active_row = [b]
        if active_row:
            active_row.sort(key=lambda s: s["x"])
            rows.append(active_row)
            
    for r in rows:
        joined = "".join([b["text"] for b in r]).upper().replace(" ", "")
        if '<' in joined or len(joined) >= 25:
            mrz_candidates.append(joined)
            
    return mrz_candidates

def _normalise_mrz_date(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    if re.fullmatch(r"\d{6}", s):
        # python-mrz commonly returns YYMMDD. Keep that canonical representation
        # here; Spring converts it to an ISO LocalDate only when it can do so.
        return s
    return s


def _unwrap_field(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("value", "")
    return "" if value is None else str(value).strip()


def _build_canonical_fields(mrz_res: Dict[str, Any], fallback_type: str, blocks: List[Dict[str, Any]], raw_text: str, avg_conf: float) -> Dict[str, Any]:
    parsed = mrz_res.get("parsed_fields", {}) if mrz_res else {}
    raw_mrz = mrz_res.get("raw_mrz", []) if mrz_res else []
    engine = blocks[0].get("engine", "NONE") if blocks else "NONE"

    if mrz_res.get("valid") and parsed:
        return {
            "document_type": {"value": _unwrap_field(parsed.get("document_type", "P")), "confidence": 0.98, "source": "MRZ", "valid": True},
            "document_number": {"value": _unwrap_field(parsed.get("document_number")), "confidence": 0.98, "source": "MRZ", "valid": True},
            "surname": {"value": _unwrap_field(parsed.get("surname")), "confidence": 0.96, "source": "MRZ", "valid": True},
            "given_names": {"value": _unwrap_field(parsed.get("given_names")), "confidence": 0.96, "source": "MRZ", "valid": True},
            "nationality": {"value": _unwrap_field(parsed.get("nationality")), "confidence": 0.95, "source": "MRZ", "valid": True},
            "date_of_birth": {"value": _normalise_mrz_date(parsed.get("birth_date")), "confidence": 0.95, "source": "MRZ", "valid": True},
            "sex": {"value": _unwrap_field(parsed.get("sex")), "confidence": 0.95, "source": "MRZ", "valid": True},
            "expiry_date": {"value": _normalise_mrz_date(parsed.get("expiry_date")), "confidence": 0.95, "source": "MRZ", "valid": True},
            "issuing_country": {"value": _unwrap_field(parsed.get("country")), "confidence": 0.95, "source": "MRZ", "valid": True},
            "personal_number": {"value": _unwrap_field(parsed.get("personal_number")), "confidence": 0.90, "source": "MRZ", "valid": True},
            "mrz_line1": {"value": raw_mrz[0] if len(raw_mrz) > 0 else "", "confidence": 0.98, "source": "MRZ", "valid": True},
            "mrz_line2": {"value": raw_mrz[1] if len(raw_mrz) > 1 else "", "confidence": 0.98, "source": "MRZ", "valid": True},
            "ocr_engine": engine,
        }

    # Non-MRZ fallback is deliberately conservative. Do not invent identity fields.
    doc_num_match = re.search(r"\b[A-Z][A-Z0-9]{7,8}\b", raw_text.upper())
    doc_num = doc_num_match.group(0) if doc_num_match else ""
    return {
        "document_type": {"value": fallback_type, "confidence": round(avg_conf, 2), "source": "OCR", "valid": bool(avg_conf >= 0.55)},
        "document_number": {"value": doc_num, "confidence": round(avg_conf, 2) if doc_num else 0.0, "source": "OCR", "valid": bool(doc_num)},
        "ocr_engine": engine,
        "raw_text_summary": {"value": raw_text[:500], "confidence": round(avg_conf, 2), "source": "OCR", "valid": bool(raw_text)},
    }


def extract_ocr_fields(img_bytes: bytes, expected_doc_type: str = "PASSPORT", logs: List = None) -> Dict[str, Any]:
    """Decode, preprocess, OCR, parse MRZ and return one canonical OCR schema."""
    if logs is None:
        logs = []
    t0 = time.time()

    nparr = np.frombuffer(img_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if image is None:
        return {"success": False, "error": "Failed to decode image", "fields": {}}

    quality = analyze_image_quality(image)
    logs.append({"type": "INFO", "text": f"Quality metrics: blur={quality['blur_level']}, sharpness={quality['laplacian_var']:.1f}, contrast={quality['contrast']:.1f}"})

    variants = build_preprocessing_variants(image, quality)
    logs.append({"type": "INFO", "text": f"Generated {len(variants)} preprocessing variants"})

    # Run multiple variants when the first result is weak. This fixes the old
    # "11 boxes at 0.12 confidence = success" behavior.
    candidate_blocks: List[List[Dict[str, Any]]] = []
    for name in ("variant_a", "variant_b", "variant_c", "variant_d"):
        if name not in variants:
            continue
        blocks = run_ocr_on_variant(variants[name], tesseract_psm=6)
        if blocks:
            candidate_blocks.append(blocks)
        if blocks and _ocr_quality(blocks) >= 0.72:
            break

    if not candidate_blocks:
        blocks = []
    else:
        blocks = max(candidate_blocks, key=_ocr_quality)

    avg_conf = float(np.mean([b["confidence"] for b in blocks])) if blocks else 0.0
    full_text = " ".join(b["text"] for b in sorted(blocks, key=lambda b: (b["y"], b["x"])))
    engine = blocks[0].get("engine", "NONE") if blocks else "NONE"
    logs.append({"type": "INFO", "text": f"OCR engine={engine}; extracted {len(blocks)} text blocks (avg confidence: {avg_conf:.2f})"})

    # Dedicated MRZ pass: the lower portion of passports is structurally regular.
    h, w = image.shape[:2]
    mrz_candidates_blocks: List[Dict[str, Any]] = []
    for variant_name in ("variant_c", "variant_d", "variant_b"):
        v = variants.get(variant_name)
        if v is None:
            continue
        vh = v.shape[0]
        band = v[int(vh * 0.58):vh, :]
        mrz_blocks = run_ocr_on_variant(band, tesseract_psm=6)
        mrz_candidates_blocks.extend(mrz_blocks)
        if len(mrz_blocks) >= 2:
            break

    mrz_lines = extract_mrz_lines_from_blocks(mrz_candidates_blocks or blocks)
    mrz_res = parse_mrz_text(mrz_lines)
    if mrz_res.get("valid"):
        logs.append({"type": "INFO", "text": f"MRZ validated successfully ({mrz_res.get('mrz_type')})"})
    else:
        logs.append({"type": "WARN", "text": f"MRZ not validated: {mrz_res.get('error_reason', 'No valid MRZ found')}"})

    fields = _build_canonical_fields(mrz_res, expected_doc_type, blocks, full_text, avg_conf)
    face_crop_b64 = crop_face_b64_from_doc(image, logs)
    proc_time_ms = int((time.time() - t0) * 1000)

    return {
        "success": bool(blocks),
        "document_type": expected_doc_type,
        "processing_time_ms": proc_time_ms,
        "quality_metrics": quality,
        "ocr_confidence": round(avg_conf, 2),
        "ocr_engine": engine,
        "mrz_result": mrz_res,
        "fields": fields,
        "face_crop_b64": face_crop_b64,
        "raw_text": full_text,
    }

def validate_document(ocr_res: Dict[str, Any], logs: List = None) -> Dict[str, Any]:
    """Deterministic document validation engine."""
    if logs is None:
        logs = []
        
    mrz_res = ocr_res.get("mrz_result", {})
    mrz_valid = mrz_res.get("valid", False)
    checksum_details = mrz_res.get("checksum_details", {})
    
    checks = []
    
    # 1. MRZ Checksum Checks
    checks.append({
        "check_group": "CHECKSUM",
        "check_name": "Document Number Checksum",
        "passed": checksum_details.get("document_number_valid", mrz_valid),
        "detail": "ICAO 7-3-1 modulus 10 check digit"
    })
    checks.append({
        "check_group": "CHECKSUM",
        "check_name": "Date of Birth Checksum",
        "passed": checksum_details.get("birth_date_valid", mrz_valid),
        "detail": "ICAO 7-3-1 modulus 10 check digit"
    })
    checks.append({
        "check_group": "CHECKSUM",
        "check_name": "Expiry Date Checksum",
        "passed": checksum_details.get("expiry_date_valid", mrz_valid),
        "detail": "ICAO 7-3-1 modulus 10 check digit"
    })
    checks.append({
        "check_group": "CHECKSUM",
        "check_name": "Composite MRZ Checksum",
        "passed": checksum_details.get("composite_valid", mrz_valid),
        "detail": "Full MRZ composite check digit"
    })
    
    # 2. Expiry Check
    fields = ocr_res.get("fields", {})
    expiry = _unwrap_field(fields.get("expiry_date", ""))
    is_expired = False
    try:
        from datetime import date
        if re.fullmatch(r"\d{6}", expiry):
            yy, mm, dd = int(expiry[:2]), int(expiry[2:4]), int(expiry[4:6])
            today = date.today()
            # Passport MRZ dates are YYMMDD; resolve the century relative to today.
            year = 2000 + yy if yy <= (today.year % 100 + 20) else 1900 + yy
            is_expired = date(year, mm, dd) < today
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", expiry):
            from datetime import date
            is_expired = date.fromisoformat(expiry) < date.today()
    except Exception:
        is_expired = False
            
    checks.append({
        "check_group": "DATE_LOGIC",
        "check_name": "Document Expiry Check",
        "passed": not is_expired,
        "detail": "Document is expired" if is_expired else "Document valid and unexpired"
    })
    
    all_passed = all([c["passed"] for c in checks])
    
    return {
        "valid": all_passed,
        "document_type": ocr_res.get("document_type", "UNKNOWN"),
        "checks": checks,
        "passed_count": sum(1 for c in checks if c["passed"]),
        "total_count": len(checks)
    }
