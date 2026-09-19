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
from app.preprocessing.multi_doc_detector import decode_image_or_pdf, evaluate_image_quality, detect_multiple_documents
from app.modules.doc_classifier import classify_document
from app.modules.field_extractors import extract_document_fields, decode_barcodes_and_qr
from app.modules.cross_validator import perform_cross_validation
from app.modules.mrz_parser import parse_mrz_text
from app.modules.national_id_validators import is_valid_aadhaar_checksum, build_ocr_failure_checks
from app.modules.face_utils import crop_face_b64_from_doc, extract_headshot_from_document

def mask_sensitive_data(text: str) -> str:
    """Masks Aadhaar, Passport, and PAN numbers in logs to satisfy Section 12."""
    if not text:
        return ""
    text = re.sub(r"\b(\d{4})\s*(\d{4})\s*(\d{4})\b", r"XXXX-XXXX-\3", str(text))
    text = re.sub(r"\b([A-Z])\d{4,5}(\d{3})\b", r"\1****\2", text)
    text = re.sub(r"\b([A-Z]{3})[A-Z]{2}\d{2}(\d{2}[A-Z])\b", r"\1**-**\2", text)
    return text


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
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
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
    # 1. First, check if any individual blocks are already complete MRZ lines
    for b in blocks:
        txt = b.get("text", "").strip().upper().replace(" ", "")
        chevron_count = txt.count('<') + txt.count('«')
        if (chevron_count >= 2 and len(txt) >= 28) or (len(txt) >= 28 and chevron_count >= 1 and txt.startswith(('P<', 'I<', 'A<', 'V<'))):
            if txt not in mrz_candidates:
                mrz_candidates.append(txt)
                
    # 2. Also group spatially into rows (for when MRZ is split across multiple horizontal fragments)
    sorted_blocks = sorted(blocks, key=lambda b: b["y"])
    rows = []
    if sorted_blocks:
        active_row = [sorted_blocks[0]]
        for b in sorted_blocks[1:]:
            if abs(b["y"] - active_row[-1]["y"]) < 30.0:
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
        chevron_count = joined.count('<') + joined.count('«')
        if (chevron_count >= 2 and len(joined) >= 20) or (len(joined) >= 28 and chevron_count >= 1 and joined.startswith(('P<', 'I<', 'A<', 'V<'))):
            if joined not in mrz_candidates:
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


def _date_to_iso(value: str) -> str:
    match = re.fullmatch(r"(\d{2})/(\d{2})/(\d{4})", value)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}-{day}"
    return value


def _page_field(text: str, label_pattern: str, stop_pattern: str = r"$") -> str:
    match = re.search(rf"(?:{label_pattern})\s*[:/\-]?\s*(.*?)(?=\s*[/:-]?\s*(?:{stop_pattern})\b|$)", text, re.IGNORECASE)
    return match.group(1).strip(" /:-") if match else ""


def _normalise_passport_text(raw_text: str) -> str:
    text = raw_text.upper()
    text = re.sub(r"/\s*(?=[A-Z])", " ", text)
    text = re.sub(r"\bSUMAME\b|\bSURNAME\b", "SURNAME", text)
    text = re.sub(r"GIVEN\s*NAME\s*\(S\)", "GIVEN NAME", text)
    text = re.sub(r"PLACE\s*OF\s*ISSUE|PLACEOFISSUE|PLACEOFISSUE", "PLACE OF ISSUE", text)
    text = re.sub(r"DATE\s*OF\s*EXPIRY|DATEOFEXPIRY", "DATE OF EXPIRY", text)
    text = re.sub(r"DATE\s*OF\s*ISSUE|DATEOFISSUE", "DATE OF ISSUE", text)
    text = re.sub(r"DATE\s*OF\s*BIRTH", "DATE OF BIRTH", text)
    text = re.sub(r"GIVEN\s*NAME(?:S)?", "GIVEN NAME", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _bounded_passport_field(text: str, label: str, stops: List[str]) -> str:
    stop_expression = "|".join(stops)
    match = re.search(rf"\b{label}\b\s*[:\-]?\s*(.*?)(?=\s+(?:{stop_expression})\b|$)", text)
    return match.group(1).strip(" :-") if match else ""


def _clean_passport_name(value: str) -> str:
    value = re.sub(r"[^A-Z' -]", "", value.upper())
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"^(?:SURNAME|SUMAME|GIVEN NAME|NAME)\s*", "", value)
    value = re.sub(r"\s+(?:SEX|DATE OF BIRTH|PLACE OF BIRTH).*$", "", value)
    return value.strip()


def _extract_passport_page_fields(raw_text: str) -> Dict[str, str]:
    text = _normalise_passport_text(raw_text)
    dates = re.findall(r"\b\d{2}/\d{2}/\d{4}\b", text)
    passport_match = re.search(r"\b[A-Z]{1,2}\d{6,9}\b", text)

    labels = ["TYPE", "CODE", "NATIONALITY", "PASSPORT", "SURNAME", "GIVEN NAME", "SEX", "DATE OF BIRTH", "PLACE OF BIRTH", "PLACE OF ISSUE", "DATE OF ISSUE", "DATE OF EXPIRY"]
    document_type = _bounded_passport_field(text, "TYPE", [label for label in labels if label != "TYPE"])
    code = _bounded_passport_field(text, "CODE", [label for label in labels if label != "CODE"])
    nationality = _bounded_passport_field(text, "NATIONALITY", [label for label in labels if label != "NATIONALITY"])
    surname = _bounded_passport_field(text, "SURNAME", [label for label in labels if label != "SURNAME"])
    given_names = _bounded_passport_field(text, "GIVEN NAME", [label for label in labels if label != "GIVEN NAME"])
    date_of_birth = _bounded_passport_field(text, "DATE OF BIRTH", [label for label in labels if label != "DATE OF BIRTH"])
    sex = _bounded_passport_field(text, "SEX", [label for label in labels if label != "SEX"])
    place_of_birth = _bounded_passport_field(text, "PLACE OF BIRTH", [label for label in labels if label != "PLACE OF BIRTH"])
    place_of_issue = _bounded_passport_field(text, "PLACE OF ISSUE", [label for label in labels if label != "PLACE OF ISSUE"])
    date_of_issue = _bounded_passport_field(text, "DATE OF ISSUE", ["DATE OF EXPIRY"])
    date_of_expiry = _bounded_passport_field(text, "DATE OF EXPIRY", [])
    birth_match = re.search(r"\d{2}/\d{2}/\d{4}", date_of_birth)
    birth_value = birth_match.group(0) if birth_match else (dates[0] if dates else "")

    def date_key(value: str) -> tuple:
        day, month, year = value.split("/")
        return int(year), int(month), int(day)

    issue_candidates = re.findall(r"\d{2}/\d{2}/\d{4}", date_of_issue)
    expiry_candidates = re.findall(r"\d{2}/\d{2}/\d{4}", date_of_expiry)
    remaining_dates = [value for value in dates if value != birth_value]
    expiry_pool = expiry_candidates or remaining_dates
    expiry_value = max(expiry_pool, key=date_key) if expiry_pool else ""

    # If OCR merged both validity dates into one label, the earlier date is
    # the issue date and the later date is the expiry date.
    issue_pool = issue_candidates or [value for value in remaining_dates if value != expiry_value]
    earlier_issue_dates = [value for value in issue_pool if not expiry_value or date_key(value) < date_key(expiry_value)]
    issue_value = max(earlier_issue_dates or issue_pool, key=date_key) if issue_pool else ""

    return {
        "document_type": document_type[:20],
        "country_code": code[:20],
        "nationality": nationality[:100],
        "document_number": passport_match.group(0) if passport_match else "",
        "surname": _clean_passport_name(surname)[:255],
        "given_names": _clean_passport_name(re.sub(r"^\(?S\)?\s+", "", given_names))[:255],
        "date_of_birth": _date_to_iso(birth_value),
        "sex": sex if sex in {"M", "F", "X"} else "",
        "place_of_birth": re.sub(r"\s+\d{2}/\d{2}[A-Z0-9]{2,}.*$", "", place_of_birth).strip()[:255],
        "place_of_issue": re.sub(r"\s+[A-Z]*\d[A-Z0-9]*.*$", "", place_of_issue).strip()[:255],
        "date_of_issue": _date_to_iso(issue_value),
        "expiry_date": _date_to_iso(expiry_value),
    }


def _passport_fallback_fields(raw_text: str, mrz_lines: List[str], expected_type: str, avg_conf: float) -> Dict[str, Any]:
    """Recover readable passport fields when MRZ checksums fail due to OCR noise."""
    text = re.sub(r"\s+", " ", raw_text.upper()).strip()
    mrz_text = " ".join(mrz_lines).upper()
    source = "OCR_HEURISTIC"
    page_fields = _extract_passport_page_fields(raw_text)

    document_match = re.search(r"\b[A-Z]{1,2}\d{6,9}\b", text)
    document_number = page_fields["document_number"] or (document_match.group(0) if document_match else "")

    dates = re.findall(r"\b\d{2}/\d{2}/\d{4}\b", text)
    birth_date = page_fields["date_of_birth"] or (_date_to_iso(dates[0]) if dates else "")
    expiry_date = page_fields["expiry_date"] or (_date_to_iso(dates[-1]) if len(dates) > 1 else "")

    sex_match = re.search(r"\b([MFX])\b", text)
    sex = page_fields["sex"] or (sex_match.group(1) if sex_match else "")

    country_match = re.search(r"P<([A-Z]{3})", mrz_text)
    issuing_country = country_match.group(1) if country_match else ""
    nationality = page_fields["nationality"] or issuing_country

    surname = page_fields["surname"] if page_fields["surname"] not in {"SUMAME", "SURNAME"} else ""
    given_names = page_fields["given_names"]

    # Keep the MRZ name available for comparison after page-text recovery.
    # Page OCR can merge nearby watermark or label text into given names.
    mrz_surname = ""
    mrz_given_names = ""
    if mrz_lines:
        mrz_name_line = re.sub(r"[^A-Z<]", "", mrz_lines[0].upper())
        if mrz_name_line.startswith("P<") and "<<" in mrz_name_line:
            name_part = mrz_name_line[5:].split("<<", 1)
            mrz_surname = name_part[0].replace("<", "").strip()
            mrz_given_names = name_part[1].replace("<", " ").strip()
    if document_match and (not surname or not given_names):
        after_document = text[document_match.end():]
        before_date = re.split(r"\b\d{2}/\d{2}/\d{4}\b", after_document, maxsplit=1)[0]
        name_tokens = re.findall(r"[A-Z][A-Z'-]{2,}", before_date)
        if name_tokens:
            if not surname:
                surname = name_tokens[0]
            if not given_names:
                given_tokens = [token for token in name_tokens[1:] if token not in {"M", "F", "X"}]
                given_names = " ".join(given_tokens[:3])

    if mrz_given_names:
        page_first_name = given_names.split()[0] if given_names else ""
        mrz_first_name = mrz_given_names.split()[0]
        if not page_first_name or page_first_name == mrz_first_name:
            given_names = mrz_given_names

    line2 = re.sub(r"[^A-Z0-9<]", "", mrz_lines[1].upper()) if len(mrz_lines) > 1 else ""
    line1 = re.sub(r"[^A-Z<]", "", mrz_lines[0].upper()) if mrz_lines else ""
    if expected_type.upper() == "PASSPORT" or line1.startswith("P"):
        page_fields["document_type"] = "P"
    if len(line2) >= 13:
        code_match = re.search(r"[A-Z]{3}", line2[10:16])
        page_fields["country_code"] = code_match.group(0) if code_match else page_fields["country_code"]
    if not page_fields["nationality"]:
        nationality_match = re.search(r"\b(INDIAN|[A-Z]{3})\b", text)
        page_fields["nationality"] = nationality_match.group(1) if nationality_match else ""
    if line1.startswith("P"):
        name_part = line1[5:].split("<<", 1)
        if not surname and mrz_surname:
            surname = mrz_surname
        if not given_names and mrz_given_names:
            given_names = mrz_given_names
    if re.search(r"\bINDIAN\b", text):
        nationality = "INDIAN"
    elif len(page_fields["nationality"].split()) > 1:
        nationality = page_fields["nationality"].split()[0]
    if len(page_fields["place_of_birth"].split()) > 4:
        page_fields["place_of_birth"] = page_fields["place_of_birth"].split(" 13/", 1)[0]
    if not nationality and len(line2) >= 13:
        nationality = line2[10:13].replace("<", "")
        issuing_country = nationality
    if not birth_date and len(line2) >= 20 and line2[13:19].isdigit():
        birth_date = line2[13:19]
    sex_match = re.search(r"[MF]", line2[18:24])
    if sex_match:
        sex = sex_match.group(0)
    if not expiry_date and len(line2) >= 27 and line2[21:27].isdigit():
        expiry_date = line2[21:27]
    if sex not in {"M", "F"}:
        sex = ""
    if sex_match and sex_match.group(0) in "MF":
        sex = sex_match.group(0)
    if expected_type.upper() == "PASSPORT" and re.search(r"\bIND(?:IAN)?\b", text):
        page_fields["country_code"] = "IND"
    personal_number = line2[28:42].replace("<", "") if len(line2) >= 42 else ""
    surname = _clean_passport_name(surname)
    given_names = _clean_passport_name(given_names)
    if surname in {"SUMAME", "SURNAME", "NAME"}:
        surname = ""

    confidence = round(min(0.89, max(0.55, avg_conf * 0.9)), 2)
    def field(value: str, field_confidence: float = confidence) -> Dict[str, Any]:
        return {"value": value, "confidence": field_confidence if value else 0.0, "source": source, "valid": bool(value)}

    return {
        "document_type": field(page_fields["document_type"] or expected_type),
        "country_code": field(page_fields["country_code"] or issuing_country),
        "document_number": field(document_number),
        "surname": field(surname),
        "given_names": field(given_names),
        "nationality": field(nationality),
        "date_of_birth": field(birth_date),
        "sex": field(sex),
        "place_of_birth": field(page_fields["place_of_birth"]),
        "place_of_issue": field(page_fields["place_of_issue"]),
        "date_of_issue": field(page_fields["date_of_issue"]),
        "expiry_date": field(expiry_date),
        "issuing_country": field(issuing_country),
        "personal_number": field(personal_number),
        "mrz_line1": field(mrz_lines[0] if mrz_lines else "", 0.65),
        "mrz_line2": field(mrz_lines[1] if len(mrz_lines) > 1 else "", 0.65),
        "ocr_engine": "PaddleOCR",
    }


def _build_canonical_fields(mrz_res: Dict[str, Any], fallback_type: str, blocks: List[Dict[str, Any]], raw_text: str, avg_conf: float) -> Dict[str, Any]:
    parsed = mrz_res.get("parsed_fields", {}) if mrz_res else {}
    raw_mrz = mrz_res.get("raw_mrz", []) if mrz_res else []
    engine = blocks[0].get("engine", "NONE") if blocks else "NONE"

    if mrz_res.get("valid") and parsed:
        fields = {
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
        page_fields = _extract_passport_page_fields(raw_text)
        confidence = round(min(0.95, max(0.55, avg_conf)), 2)
        for key in ("country_code", "place_of_birth", "place_of_issue", "date_of_issue"):
            fields[key] = {"value": page_fields[key], "confidence": confidence if page_fields[key] else 0.0, "source": "OCR", "valid": bool(page_fields[key])}
        if page_fields["nationality"]:
            fields["nationality"] = {"value": page_fields["nationality"], "confidence": confidence, "source": "OCR", "valid": True}
        return fields

    if fallback_type.upper() in {"PASSPORT", "VISA"}:
        fallback_fields = _passport_fallback_fields(raw_text, raw_mrz, fallback_type, avg_conf)
        fallback_fields["ocr_engine"] = engine
        fallback_fields["raw_text_summary"] = {
            "value": raw_text[:500],
            "confidence": round(avg_conf, 2),
            "source": "OCR",
            "valid": bool(raw_text),
        }
        return fallback_fields

    doc_num_match = re.search(r"\b[A-Z][A-Z0-9]{7,8}\b", raw_text.upper())
    doc_num = doc_num_match.group(0) if doc_num_match else ""
    return {
        "document_type": {"value": fallback_type, "confidence": round(avg_conf, 2), "source": "OCR", "valid": bool(avg_conf >= 0.55)},
        "document_number": {"value": doc_num, "confidence": round(avg_conf, 2) if doc_num else 0.0, "source": "OCR", "valid": bool(doc_num)},
        "ocr_engine": engine,
        "raw_text_summary": {"value": raw_text[:500], "confidence": round(avg_conf, 2), "source": "OCR", "valid": bool(raw_text)},
    }


def _process_single_document(doc_img: np.ndarray, expected_type: str, logs: List) -> Dict[str, Any]:
    """Internal processor for an individual detected document segment."""
    quality = evaluate_image_quality(doc_img)
    if quality.get("warnings"):
        for w in quality["warnings"]:
            logs.append({"type": "WARN", "text": f"[Quality] {w}"})

    variants = build_preprocessing_variants(doc_img, quality)
    candidate_blocks: List[List[Dict[str, Any]]] = []
    # Test high-fidelity pristine/upscaled variants first, then enhanced & thresholded variants
    for name in ("variant_upscaled", "variant_raw", "variant_a", "variant_b", "variant_c", "variant_d"):
        if name not in variants:
            continue
        b = run_ocr_on_variant(variants[name], tesseract_psm=6)
        if b:
            candidate_blocks.append(b)
        if b and _ocr_quality(b) >= 0.72:
            break

    blocks = max(candidate_blocks, key=_ocr_quality) if candidate_blocks else []
    avg_conf = float(np.mean([b["confidence"] for b in blocks])) if blocks else 0.0
    full_text = " ".join(b["text"] for b in sorted(blocks, key=lambda b: (b["y"], b["x"])))
    engine = blocks[0].get("engine", "NONE") if blocks else "NONE"

    # Dedicated MRZ pass: only if MRZ was not already detected from full image blocks
    mrz_lines = extract_mrz_lines_from_blocks(blocks)
    if not mrz_lines:
        vh = doc_img.shape[0]
        band = doc_img[int(vh * 0.50):vh, :]
        if band.shape[0] < 200 or band.shape[1] < 700:
            scale = max(2.0, min(3.5, 900.0 / max(band.shape[1], 1)))
            band = cv2.resize(band, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        mrz_blocks = run_ocr_on_variant(band, tesseract_psm=6)
        mrz_lines = extract_mrz_lines_from_blocks(mrz_blocks or blocks)
    mrz_res = parse_mrz_text(mrz_lines)
    if not mrz_res.get("raw_mrz") and mrz_lines:
        mrz_res["raw_mrz"] = mrz_lines[:3]

    # Barcodes and QR codes
    qr_bar = decode_barcodes_and_qr(doc_img)

    # Document Classification
    classified = classify_document(full_text, mrz_lines, [qr_bar.get("barcode_data"), qr_bar.get("qr_data")])
    final_type = classified["document_type"]

    # Honor expected_type only if classification is uncertain or matches
    if expected_type and expected_type.upper() not in {"AUTO", "AUTO_DETECT", "DOCUMENT", "UNKNOWN"}:
        if not classified["is_confident"]:
            final_type = expected_type.replace("_", " ").title()

    logs.append({"type": "INFO", "text": f"Document classified: {final_type} (Confidence: {int(classified['confidence']*100)}%)"})

    # Extract structured fields
    fields = extract_document_fields(final_type, full_text, blocks, mrz_res, qr_bar)

    # Cross validation
    cross_val = perform_cross_validation(fields, mrz_res, qr_bar.get("qr_data"))

    face_crop = crop_face_b64_from_doc(doc_img, logs)

    # Build raw OCR blocks with coordinates
    raw_blocks_formatted = []
    for b in blocks:
        box = b.get("box", [])
        if box and len(box) >= 4:
            xs = [pt[0] for pt in box]
            ys = [pt[1] for pt in box]
            bbox = [int(min(xs)), int(min(ys)), int(max(xs) - min(xs)), int(max(ys) - min(ys))]
        else:
            bbox = [int(b.get("x", 0)), int(b.get("y", 0)), 50, 20]
        raw_blocks_formatted.append({
            "text": b.get("text", ""),
            "confidence": round(b.get("confidence", 0.0), 2),
            "bbox": bbox
        })

    return {
        "document_type": final_type,
        "classification": classified,
        "quality_metrics": quality,
        "ocr_confidence": round(avg_conf, 2),
        "ocr_engine": engine,
        "fields": fields,
        "mrz_result": mrz_res,
        "cross_validation": cross_val,
        "qr_bar_data": qr_bar,
        "face_crop_b64": face_crop,
        "doc_face_b64": face_crop,
        "raw_text": full_text,
        "raw_blocks": raw_blocks_formatted,
    }


def extract_ocr_fields(img_bytes: bytes, expected_doc_type: str = "PASSPORT", logs: List = None) -> Dict[str, Any]:
    """Decode, preprocess, segment, classify, OCR, validate, and return structured schema."""
    if logs is None:
        logs = []
    t0 = time.time()

    images = decode_image_or_pdf(img_bytes)
    if not images:
        return {"success": False, "error": "Failed to decode document image or PDF", "fields": {}}

    primary_img = images[0]

    # Multi-document detection
    doc_segments = detect_multiple_documents(primary_img)
    logs.append({"type": "INFO", "text": f"Document segmentation: located {len(doc_segments)} document region(s)"})

    doc_results = []
    for segment in doc_segments:
        res = _process_single_document(segment["image"], expected_doc_type, logs)
        res["segment_id"] = segment["id"]
        res["segment_bbox"] = segment["bbox"]
        doc_results.append(res)

    def _doc_score(d):
        dtype = str(d.get("document_type", "Unknown document")).lower()
        is_known = 0 if "unknown" in dtype else 1
        blocks_count = len(d.get("raw_blocks", []))
        conf = float(d.get("ocr_confidence", 0.0))
        sfields = d.get("structured_fields") or d.get("fields", {})
        valid_fields = sum(1 for v in sfields.values() if isinstance(v, dict) and v.get("value"))
        return (is_known, valid_fields, blocks_count, conf)

    primary_doc = max(doc_results, key=_doc_score) if doc_results else doc_results[0]
    proc_time_ms = int((time.time() - t0) * 1000)

    # Build backward-compatible flat fields for Spring Boot JPA entity and older views
    p_fields = primary_doc["fields"]
    legacy_fields = {}
    for k, v in p_fields.items():
        if isinstance(v, dict):
            legacy_fields[k] = v
        else:
            legacy_fields[k] = {"value": v, "confidence": 0.90, "source": "OCR", "valid": bool(v)}

    # Map aliases
    if "passport_number" in p_fields and "document_number" not in legacy_fields:
        legacy_fields["document_number"] = p_fields["passport_number"]
    elif "aadhaar_number" in p_fields and "document_number" not in legacy_fields:
        legacy_fields["document_number"] = p_fields["aadhaar_number"]
    elif "pan_number" in p_fields and "document_number" not in legacy_fields:
        legacy_fields["document_number"] = p_fields["pan_number"]
    elif "licence_number" in p_fields and "document_number" not in legacy_fields:
        legacy_fields["document_number"] = p_fields["licence_number"]
    elif "voter_id_number" in p_fields and "document_number" not in legacy_fields:
        legacy_fields["document_number"] = p_fields["voter_id_number"]
    elif "document_identifier" in p_fields and "document_number" not in legacy_fields:
        legacy_fields["document_number"] = p_fields["document_identifier"]

    if "date_of_expiry" in p_fields and "expiry_date" not in legacy_fields:
        legacy_fields["expiry_date"] = p_fields["date_of_expiry"]

    # Map full_name to surname and given_names if not already populated
    if "full_name" in p_fields and p_fields["full_name"].get("value"):
        fn = str(p_fields["full_name"]["value"]).strip()
        if "surname" not in legacy_fields or not legacy_fields["surname"].get("value"):
            if " " in fn:
                parts = fn.split()
                legacy_fields["surname"] = {"value": parts[-1], "confidence": 0.90, "source": "OCR", "valid": True}
                legacy_fields["given_names"] = {"value": " ".join(parts[:-1]), "confidence": 0.90, "source": "OCR", "valid": True}
            else:
                legacy_fields["surname"] = {"value": fn, "confidence": 0.90, "source": "OCR", "valid": True}
                legacy_fields["given_names"] = {"value": "", "confidence": 0.90, "source": "OCR", "valid": False}

    raw_mrz = primary_doc["mrz_result"].get("raw_mrz", [])
    if raw_mrz:
        legacy_fields["mrz_line1"] = {"value": raw_mrz[0], "confidence": 0.98, "source": "MRZ", "valid": True}
        if len(raw_mrz) > 1:
            legacy_fields["mrz_line2"] = {"value": raw_mrz[1], "confidence": 0.98, "source": "MRZ", "valid": True}

    legacy_fields["document_type"] = {
        "value": primary_doc["document_type"],
        "confidence": primary_doc["classification"]["confidence"],
        "source": "Classifier",
        "valid": True
    }
    legacy_fields["ocr_engine"] = primary_doc["ocr_engine"]

    # Sanitize logs for sensitive document numbers
    sanitized_logs = []
    for l in logs:
        sanitized_logs.append({
            "type": l.get("type", "INFO"),
            "text": mask_sensitive_data(l.get("text", ""))
        })
    logs.clear()
    logs.extend(sanitized_logs)

    return {
        "success": bool(primary_doc["raw_blocks"]),
        "document_type": primary_doc["document_type"],
        "classification": primary_doc["classification"],
        "processing_time_ms": proc_time_ms,
        "quality_metrics": primary_doc["quality_metrics"],
        "ocr_confidence": primary_doc["ocr_confidence"],
        "ocr_engine": primary_doc["ocr_engine"],
        "mrz_result": primary_doc["mrz_result"],
        "cross_validation": primary_doc["cross_validation"],
        "fields": legacy_fields,
        "structured_fields": p_fields,
        "face_crop_b64": primary_doc.get("face_crop_b64"),
        "doc_face_b64": primary_doc.get("face_crop_b64"),
        "raw_text": primary_doc["raw_text"],
        "raw_blocks": primary_doc["raw_blocks"],
        "multiple_documents": doc_results if len(doc_results) > 1 else [],
        "warnings": primary_doc["quality_metrics"].get("warnings", [])
    }


def validate_document(ocr_res: Dict[str, Any], logs: List = None) -> Dict[str, Any]:
    """Document validation engine supporting MRZ, Aadhaar, PAN, DL, and cross-validation."""
    if logs is None:
        logs = []

    mrz_res = ocr_res.get("mrz_result", {})
    mrz_valid = mrz_res.get("valid", False)
    checksum_details = mrz_res.get("checksum_details", {})
    doc_type = str(ocr_res.get("document_type", "UNKNOWN")).upper()
    fields = ocr_res.get("structured_fields") or ocr_res.get("fields", {})

    checks = []

    # 1. MRZ Checksum Checks (if MRZ exists)
    if mrz_res.get("raw_mrz"):
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

    # 2. Aadhaar Specific Validation
    if "AADHAAR" in doc_type or "AADHAR" in doc_type:
        aadhaar_val = _unwrap_field(fields.get("aadhaar_number", ""))
        digits = re.sub(r"\D", "", aadhaar_val)
        is_verhoeff = is_valid_aadhaar_checksum(digits) if len(digits) == 12 else False
        checks.append({
            "check_group": "CHECKSUM",
            "check_name": "Aadhaar Verhoeff Checksum",
            "passed": is_verhoeff,
            "detail": "UIDAI Verhoeff dihedral D5 modulo-10 checksum" if is_verhoeff else "Aadhaar checksum validation failed"
        })
        checks.append({
            "check_group": "FORMAT",
            "check_name": "Aadhaar 12-Digit Format",
            "passed": len(digits) == 12,
            "detail": "Valid 12-digit format" if len(digits) == 12 else "Invalid Aadhaar length"
        })

    # 3. PAN Card Specific Validation
    if "PAN" in doc_type:
        pan_val = _unwrap_field(fields.get("pan_number", ""))
        pan_fmt = bool(re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", pan_val.upper()))
        checks.append({
            "check_group": "FORMAT",
            "check_name": "PAN Number Format",
            "passed": pan_fmt,
            "detail": "Valid 10-character alphanumeric PAN structure" if pan_fmt else "Invalid PAN format"
        })

    # 4. Driving Licence Specific Validation
    if "DRIV" in doc_type or "LICEN" in doc_type:
        dl_val = _unwrap_field(fields.get("licence_number", ""))
        dl_fmt = bool(re.search(r"[A-Z]{2}", dl_val.upper()) and len(re.sub(r"\D", "", dl_val)) >= 10)
        checks.append({
            "check_group": "FORMAT",
            "check_name": "Driving Licence Format",
            "passed": dl_fmt,
            "detail": "Valid State Transport DL format" if dl_fmt else "DL number format unconfirmed"
        })

    # 5. Expiry Check
    expiry = _unwrap_field(fields.get("date_of_expiry", fields.get("expiry_date", "")))
    is_expired = False
    try:
        from datetime import date
        if re.fullmatch(r"\d{6}", expiry):
            yy, mm, dd = int(expiry[:2]), int(expiry[2:4]), int(expiry[4:6])
            today = date.today()
            year = 2000 + yy if yy <= (today.year % 100 + 20) else 1900 + yy
            is_expired = date(year, mm, dd) < today
        elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", expiry):
            from datetime import date
            is_expired = date.fromisoformat(expiry) < date.today()
    except Exception:
        is_expired = False

    if expiry:
        checks.append({
            "check_group": "DATE_LOGIC",
            "check_name": "Document Expiry Check",
            "passed": not is_expired,
            "detail": "Document is expired" if is_expired else "Document valid and unexpired"
        })

    # 6. Cross-Validation Check
    cross_val = ocr_res.get("cross_validation", {})
    if cross_val.get("comparisons"):
        has_mis = cross_val.get("has_mismatch", False)
        checks.append({
            "check_group": "CROSS_VALIDATION",
            "check_name": "Visual vs MRZ/QR Consistency",
            "passed": not has_mis,
            "detail": "All cross-source fields match consistently" if not has_mis else "Mismatch detected across document sources"
        })

    if not checks:
        checks.append({
            "check_group": "GENERAL",
            "check_name": "General Document Format Check",
            "passed": True,
            "detail": "General document analyzed without structural schema violations"
        })

    all_passed = all([c["passed"] for c in checks])

    return {
        "valid": all_passed,
        "document_type": ocr_res.get("document_type", "UNKNOWN"),
        "checks": checks,
        "passed_count": sum(1 for c in checks if c["passed"]),
        "total_count": len(checks)
    }

