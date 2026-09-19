# app/modules/field_extractors.py
import re
from datetime import datetime
import cv2
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from app.modules.national_id_validators import is_valid_aadhaar_checksum

# Country mapping table for ISO 3166-1 alpha-3
COUNTRY_CODE_MAP = {
    "IND": "India", "USA": "United States", "GBR": "United Kingdom", "CAN": "Canada",
    "AUS": "Australia", "DEU": "Germany", "FRA": "France", "ITA": "Italy",
    "JPN": "Japan", "CHN": "China", "RUS": "Russia", "SGP": "Singapore",
    "MYS": "Malaysia", "ARE": "United Arab Emirates", "SAU": "Saudi Arabia",
    "NPL": "Nepal", "BGD": "Bangladesh", "LKA": "Sri Lanka", "PAK": "Pakistan",
    "BRA": "Brazil", "ZAF": "South Africa", "ESP": "Spain", "MEX": "Mexico"
}

def decode_barcodes_and_qr(image: np.ndarray) -> Dict[str, Any]:
    """Detects and decodes QR codes and Barcodes present on the document."""
    results = {"qr_data": None, "barcode_data": None, "qr_bbox": None, "barcode_bbox": None}
    try:
        # 1. QR Code
        qr_detector = cv2.QRCodeDetector()
        data, bbox, _ = qr_detector.detectAndDecode(image)
        if data:
            results["qr_data"] = data.strip()
            if bbox is not None and len(bbox) > 0:
                pts = bbox[0].astype(int)
                x = int(np.min(pts[:, 0]))
                y = int(np.min(pts[:, 1]))
                w = int(np.max(pts[:, 0]) - x)
                h = int(np.max(pts[:, 1]) - y)
                results["qr_bbox"] = [x, y, w, h]
    except Exception:
        pass
        
    try:
        # 2. Barcode (OpenCV barcode detector if available)
        if hasattr(cv2, "barcode_BarcodeDetector"):
            barcode_detector = cv2.barcode_BarcodeDetector()
            ok, decoded_info, decoded_type, corners = barcode_detector.detectAndDecode(image)
            if ok and decoded_info and len(decoded_info) > 0 and decoded_info[0]:
                results["barcode_data"] = decoded_info[0].strip()
                if corners is not None and len(corners) > 0:
                    pts = corners[0].astype(int)
                    x = int(np.min(pts[:, 0]))
                    y = int(np.min(pts[:, 1]))
                    w = int(np.max(pts[:, 0]) - x)
                    h = int(np.max(pts[:, 1]) - y)
                    results["barcode_bbox"] = [x, y, w, h]
    except Exception:
        pass
        
    return results

def normalize_date(date_str: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Normalizes dates from various formats (DD/MM/YYYY, DD-MM-YYYY, YYYY/MM/DD, DD MMM YYYY, YYMMDD)
    into standard ISO YYYY-MM-DD format while returning both (normalized, original).
    """
    if not date_str:
        return None, None
    raw = date_str.strip()
    
    # Check DD/MM/YYYY or DD-MM-YYYY
    m1 = re.search(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", raw)
    if m1:
        d, m, y = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
        if 1 <= d <= 31 and 1 <= m <= 12 and 1900 <= y <= 2100:
            return f"{y:04d}-{m:02d}-{d:02d}", raw
            
    # Check YYYY-MM-DD or YYYY/MM/DD
    m2 = re.search(r"\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b", raw)
    if m2:
        y, m, d = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        if 1 <= d <= 31 and 1 <= m <= 12 and 1900 <= y <= 2100:
            return f"{y:04d}-{m:02d}-{d:02d}", raw
            
    # Check DD MMM YYYY (e.g. 01 JAN 1990)
    months = {
        "JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
        "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12
    }
    m3 = re.search(r"\b(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\b", raw)
    if m3:
        d = int(m3.group(1))
        mon_str = m3.group(2).upper()
        y = int(m3.group(3))
        if mon_str in months and 1 <= d <= 31:
            return f"{y:04d}-{months[mon_str]:02d}-{d:02d}", raw
            
    # Check YYMMDD (6 digits from MRZ)
    if re.fullmatch(r"\d{6}", raw):
        yy, mm, dd = int(raw[:2]), int(raw[2:4]), int(raw[4:6])
        if 1 <= dd <= 31 and 1 <= mm <= 12:
            # Pivot century: e.g. YY <= 40 -> 20YY, else 19YY
            year = 2000 + yy if yy <= 40 else 1900 + yy
            return f"{year:04d}-{mm:02d}-{dd:02d}", raw

    return None, raw

def disambiguate_numeric(text: str) -> str:
    """Disambiguates visual characters in strictly numeric contexts (O->0, I->1, S->5, B->8, Z->2)."""
    trans = str.maketrans("OISBZQ", "015820")
    return text.translate(trans)

def disambiguate_alpha(text: str) -> str:
    """Disambiguates visual characters in strictly alphabetic contexts (0->O, 1->I, 5->S, 8->B, 2->Z)."""
    trans = str.maketrans("01582", "OISBZ")
    return text.translate(trans)

def find_block_bbox(blocks: List[Dict[str, Any]], pattern: str) -> Optional[List[int]]:
    """Finds the bounding box [x, y, w, h] of a block matching a regex pattern."""
    for b in blocks:
        if re.search(pattern, b.get("text", ""), re.IGNORECASE):
            box = b.get("box")
            if box and len(box) >= 4:
                xs = [pt[0] for pt in box]
                ys = [pt[1] for pt in box]
                return [int(min(xs)), int(min(ys)), int(max(xs) - min(xs)), int(max(ys) - min(ys))]
    return None

def find_block_info(blocks: List[Dict[str, Any]], pattern: str) -> Tuple[Optional[List[int]], Optional[float]]:
    """Finds the bounding box [x, y, w, h] and confidence of a block matching a regex pattern."""
    for b in blocks:
        if re.search(pattern, b.get("text", ""), re.IGNORECASE):
            box = b.get("box")
            bbox = None
            if box and len(box) >= 4:
                xs = [pt[0] for pt in box]
                ys = [pt[1] for pt in box]
                bbox = [int(min(xs)), int(min(ys)), int(max(xs) - min(xs)), int(max(ys) - min(ys))]
            conf = b.get("confidence")
            return bbox, conf
    return None, None

def build_field(
    value: Optional[str],
    confidence: float,
    source: str = "visual_text",
    raw_value: Optional[str] = None,
    bbox: Optional[List[int]] = None,
    status: Optional[str] = None,
    validation: Optional[str] = None
) -> Dict[str, Any]:
    """Constructs a canonical field object conforming to requirements."""
    if not value or str(value).strip() == "":
        return {
            "value": None,
            "raw_value": raw_value,
            "confidence": 0.0,
            "source": source,
            "bbox": None,
            "status": "Not detected",
            "validation": "unverified"
        }
        
    conf = max(0.0, min(1.0, round(confidence, 2)))
    
    if status is None:
        if conf < 0.70:
            status = "Needs verification"
        else:
            status = "Verified"
            
    if validation is None:
        validation = "valid" if status == "Verified" else "pending"

    return {
        "value": str(value).strip(),
        "raw_value": str(raw_value).strip() if raw_value else str(value).strip(),
        "confidence": conf,
        "source": source,
        "bbox": bbox,
        "status": status,
        "validation": validation
    }

# ----------------- PASSPORT EXTRACTOR -----------------
def extract_passport(raw_text: str, blocks: List[Dict[str, Any]], mrz_data: Dict[str, Any]) -> Dict[str, Any]:
    text = (raw_text or "").upper()
    parsed_mrz = mrz_data.get("parsed_fields", {})
    mrz_valid = mrz_data.get("valid", False)
    checksums = mrz_data.get("checksum_details", {})
    
    # 1. Document Number
    mrz_doc_num = parsed_mrz.get("document_number")
    mrz_num_clean = re.sub(r"[^A-Z0-9]", "", mrz_doc_num) if mrz_doc_num else None
    
    # Match standard passport numbers: 1-2 uppercase letters + 6-8 digits
    visual_doc_match = re.search(r"\b([A-Z]{1,2}\d{6,8})\b", text)
    visual_doc_num = visual_doc_match.group(1) if visual_doc_match else None
    doc_bbox, visual_doc_conf = find_block_info(blocks, r"\b[A-Z]{1,2}\d{6,8}\b")
    
    if mrz_num_clean and len(mrz_num_clean) >= 7:
        doc_num_final = mrz_num_clean
        doc_conf = 0.99 if checksums.get("document_number_valid", True) else 0.92
        doc_src = "MRZ"
    elif visual_doc_num:
        doc_num_final = visual_doc_num
        doc_conf = round(float(visual_doc_conf), 2) if visual_doc_conf else 0.88
        doc_src = "visual_text"
    else:
        doc_num_final = None
        doc_conf = 0.0
        doc_src = "visual_text"
    
    # 2. Names
    mrz_surname = parsed_mrz.get("surname")
    mrz_given = parsed_mrz.get("given_names")
    
    invalid_name_tokens = {"NATIONALITY", "PASSPORT", "REPUBLIC", "INDIA", "INDIAN", "DATE", "BIRTH", "EXPIRY"}
    if mrz_surname and any(w in mrz_surname for w in invalid_name_tokens):
        mrz_surname = None
    if mrz_given and any(w in mrz_given for w in invalid_name_tokens):
        mrz_given = None
    
    visual_s_match = re.search(r"(?:SURNAME|SUMAME)\s*[:/-]?\s*([A-Z][A-Z' -]{1,30}[A-Z])", text)
    visual_surname = visual_s_match.group(1).strip() if visual_s_match else None
    _, visual_s_conf = find_block_info(blocks, r"\b(?:SURNAME|SUMAME)\b") if visual_surname else (None, None)
    
    visual_g_match = re.search(r"GIVEN\s*NAMES?(?:\s*\(S\))?\s*[:/-]?\s*([A-Z][A-Z' -]{1,35}[A-Z])", text)
    visual_given = visual_g_match.group(1).strip() if visual_g_match else None
    _, visual_g_conf = find_block_info(blocks, r"\bGIVEN\s*NAME") if visual_given else (None, None)
    
    # Recover surname from visual blocks if MRZ surname was truncated or single character
    if (not mrz_surname or len(mrz_surname) <= 1) and blocks:
        for b in blocks:
            b_txt = b.get("text", "").strip().upper()
            if b_txt.isalpha() and 2 <= len(b_txt) <= 15:
                if b_txt not in invalid_name_tokens and not any(kw in b_txt for kw in ["TYPE", "CODE", "SEX"]):
                    # If this block comes before given names vertically, it could be surname
                    if visual_given and b_txt in visual_given:
                        continue
                    if mrz_given and b_txt in mrz_given:
                        continue
                    # Check if candidate surname matches end of line 1 before '<<'
                    raw_mrz = mrz_data.get("raw_mrz", [])
                    if raw_mrz and b_txt in raw_mrz[0].split("<<")[0]:
                        mrz_surname = b_txt
                        break

    if mrz_surname and len(mrz_surname) > 1 and mrz_surname.replace(" ", "").isalpha():
        surname_final = mrz_surname
        surname_conf = 0.99 if (mrz_valid and checksums.get("composite_valid", True)) else 0.95
        surname_src = "MRZ"
    elif visual_surname:
        surname_final = visual_surname
        surname_conf = round(float(visual_s_conf), 2) if visual_s_conf else 0.88
        surname_src = "visual_text"
    elif mrz_surname:
        surname_final = mrz_surname
        surname_conf = 0.90
        surname_src = "MRZ"
    else:
        surname_final = None
        surname_conf = 0.0
        surname_src = "visual_text"
        
    if mrz_given and (mrz_valid or mrz_given.replace(" ", "").isalpha()):
        given_final = mrz_given
        given_conf = 0.99 if (mrz_valid and checksums.get("composite_valid", True)) else 0.95
        given_src = "MRZ"
    elif visual_given:
        given_final = visual_given
        given_conf = round(float(visual_g_conf), 2) if visual_g_conf else 0.88
        given_src = "visual_text"
    else:
        given_final = None
        given_conf = 0.0
        given_src = "visual_text"
    
    full_name_final = None
    if surname_final and given_final:
        full_name_final = f"{given_final} {surname_final}"
        name_conf = min(surname_conf, given_conf)
        name_src = surname_src if surname_src == given_src else "MRZ"
    elif given_final or surname_final:
        full_name_final = given_final or surname_final
        name_conf = given_conf or surname_conf
        name_src = given_src or surname_src
    else:
        name_conf = 0.0
        name_src = "visual_text"
        
    # 3. Dates
    mrz_dob = parsed_mrz.get("birth_date")
    norm_mrz_dob, raw_mrz_dob = normalize_date(mrz_dob)
    
    mrz_expiry = parsed_mrz.get("expiry_date")
    norm_mrz_exp, raw_mrz_exp = normalize_date(mrz_expiry)
    
    dob_match = re.search(r"(?:DATE\s*OF\s*BIRTH|DOB)\s*[:/-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4}|\d{2}\s+[A-Za-z]{3}\s+\d{4})", text)
    visual_dob_norm, visual_dob_raw = normalize_date(dob_match.group(1)) if dob_match else (None, None)
    
    exp_match = re.search(r"(?:DATE\s*OF\s*EXPIRY|EXPIRY\s*DATE)\s*[:/-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4}|\d{2}\s+[A-Za-z]{3}\s+\d{4})", text)
    visual_exp_norm, visual_exp_raw = normalize_date(exp_match.group(1)) if exp_match else (None, None)

    issue_match = re.search(r"(?:DATE\s*OF\s*ISSUE|ISSUE\s*DATE)\s*[:/-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4}|\d{2}\s+[A-Za-z]{3}\s+\d{4})", text)
    visual_issue_norm, visual_issue_raw = normalize_date(issue_match.group(1)) if issue_match else (None, None)

    all_dates = re.findall(r"\b(\d{2}[/.-]\d{2}[/.-]\d{4})\b", text)
    if not visual_dob_norm and all_dates:
        visual_dob_norm = normalize_date(all_dates[0])[0]

    # Date of Birth
    if norm_mrz_dob:
        final_dob = norm_mrz_dob
        dob_raw = raw_mrz_dob
        dob_conf = 0.99 if checksums.get("birth_date_valid", True) else 0.90
        dob_src = "MRZ"
    elif visual_dob_norm:
        final_dob = visual_dob_norm
        dob_raw = visual_dob_raw
        dob_conf = 0.90
        dob_src = "visual_text"
    else:
        final_dob = None
        dob_raw = None
        dob_conf = 0.0
        dob_src = "visual_text"

    non_dob_dates = sorted([d for d in [normalize_date(x)[0] for x in all_dates] if d and d != final_dob])
    if len(non_dob_dates) >= 2:
        visual_issue_norm = non_dob_dates[0]
        visual_exp_norm = non_dob_dates[-1]
    elif non_dob_dates:
        visual_issue_norm = non_dob_dates[0]

    # Date of Expiry
    if norm_mrz_exp:
        final_expiry = norm_mrz_exp
        exp_raw = raw_mrz_exp
        exp_conf = 0.99 if checksums.get("expiry_date_valid", True) else 0.90
        exp_src = "MRZ"
    elif visual_exp_norm:
        final_expiry = visual_exp_norm
        exp_raw = visual_exp_raw
        exp_conf = 0.90
        exp_src = "visual_text"
    else:
        final_expiry = None
        exp_raw = None
        exp_conf = 0.0
        exp_src = "visual_text"

    issue_conf = 0.90 if visual_issue_norm else 0.0
    
    # 4. Nationality & Country Code
    country_code = parsed_mrz.get("country") if (parsed_mrz.get("country")) else ("IND" if "INDIAN" in text or "REPUBLIC OF INDIA" in text else None)
    if country_code == "DOE" or (country_code and country_code not in COUNTRY_CODE_MAP and "INDIA" in text):
        country_code = "IND"

    nat_match = re.search(r"\bNATIONALITY\s*[:/-]?\s*([A-Z]{3,20}?)(?=\s+(?:SEX|DATE|DOB|SURNAME)|\n|$)", text)
    visual_nat = nat_match.group(1).strip() if nat_match else None
    nat_code = (parsed_mrz.get("nationality") if mrz_valid else None) or (visual_nat if visual_nat else country_code)
    if nat_code in ("1ND", "IND") or "INDIAN" in text:
        nat_code = "IND"
    nat_country = COUNTRY_CODE_MAP.get(nat_code, nat_code) if nat_code else ("India" if "INDIAN" in text else None)
    
    nat_conf = 0.99 if (parsed_mrz.get("nationality")) else (0.95 if nat_country else 0.0)
    nat_src = "MRZ" if (parsed_mrz.get("nationality")) else "visual_text"
    
    # 5. Sex
    mrz_sex = parsed_mrz.get("sex")
    if mrz_sex and mrz_sex in {"M", "F", "X"}:
        sex = mrz_sex
        sex_conf = 0.99 if mrz_valid else 0.95
        sex_src = "MRZ"
    else:
        sex_m = re.search(r"\b(?:SEX|GENDER)\b.*?\b([MFX])\b", text)
        sex = sex_m.group(1) if sex_m else None
        sex_conf = 0.90 if sex else 0.0
        sex_src = "visual_text"
        
    # 6. Place of Birth / Place of Issue
    pob_match = re.search(r"PLACE\s*OF\s*BIRTH\s*[:/-]?\s*([A-Z][A-Z' ,-]{2,40}[A-Z])(?=\s+\d|\s*/|$)", text)
    pob = pob_match.group(1).strip(" ,-") if pob_match else None
    if not pob and blocks:
        for b in blocks:
            bt = b.get("text", "").strip()
            if any(k in bt.upper() for k in ["BENGAL", "DELHI", "MUMBAI", "KERALA", "GUJARAT", "MAHARASHTRA", "TAMIL"]):
                pob = bt
                break
    _, pob_conf_raw = find_block_info(blocks, r"PLACE\s*OF\s*BIRTH") if pob else (None, None)
    pob_conf = round(float(pob_conf_raw), 2) if pob_conf_raw else (0.88 if pob else 0.0)
    
    clean_text = re.sub(r"PLACE\s*OF\s*ISSUE|PLACEOFISSUE", "PLACE OF ISSUE", text)
    poi_match = re.search(r"PLACE\s*OF\s*ISSUE\s*[:/-]?\s*([A-Z]{3,20})\b", clean_text)
    poi = poi_match.group(1).strip(" ,-") if poi_match else None
    if not poi and blocks:
        for b in blocks:
            bt = b.get("text", "").strip().upper()
            if bt in ["SURAT", "DHAKA", "CHENNAI", "DELHI", "MUMBAI", "KOLKATA", "HYDERABAD", "BANGALORE", "AHMEDABAD"]:
                poi = bt
                break
    _, poi_conf_raw = find_block_info(blocks, r"PLACE\s*OF\s*ISSUE|PLACEOFISSUE") if poi else (None, None)
    poi_conf = round(float(poi_conf_raw), 2) if poi_conf_raw else (0.88 if poi else 0.0)
    
    auth_match = re.search(r"(?:ISSUING\s*AUTHORITY|AUTHORITY)\s*[:/-]?\s*([A-Z' -]{2,40})", text)
    issuing_auth = auth_match.group(1).strip() if auth_match else None
    auth_conf = 0.85 if issuing_auth else 0.0
    
    # 7. Passport Type
    raw_doc_type = parsed_mrz.get("document_type") if mrz_valid else None
    if raw_doc_type and raw_doc_type in {"P", "D", "S"}:
        passport_type = raw_doc_type
        type_conf = 0.99
        type_src = "MRZ"
    else:
        type_m = re.search(r"\bTYPE\s*[:/-]?\s*([PDS])\b", text)
        passport_type = type_m.group(1) if type_m else "P"
        type_conf = 0.95
        type_src = "visual_text"
        
    personal_num = parsed_mrz.get("personal_number") if (mrz_valid and parsed_mrz.get("personal_number") and parsed_mrz.get("personal_number").strip("<")) else None
    
    return {
        "surname": build_field(surname_final, surname_conf, surname_src),
        "given_names": build_field(given_final, given_conf, given_src),
        "full_name": build_field(full_name_final, name_conf, name_src),
        "nationality": build_field(nat_country, nat_conf, nat_src, raw_value=nat_code),
        "country_code": build_field(country_code, nat_conf, nat_src),
        "date_of_birth": build_field(final_dob, dob_conf, dob_src, raw_value=dob_raw),
        "place_of_birth": build_field(pob, pob_conf, "visual_text"),
        "sex": build_field(sex, sex_conf, sex_src),
        "passport_number": build_field(doc_num_final, doc_conf, doc_src, bbox=doc_bbox, raw_value=visual_doc_num or doc_num_final),
        "passport_type": build_field(passport_type, type_conf, type_src),
        "date_of_issue": build_field(visual_issue_norm, issue_conf, "visual_text", raw_value=visual_issue_raw),
        "date_of_expiry": build_field(final_expiry, exp_conf, exp_src, raw_value=exp_raw),
        "place_of_issue": build_field(poi, poi_conf, "visual_text"),
        "issuing_authority": build_field(issuing_auth, auth_conf, "visual_text"),
        "personal_number": build_field(personal_num, 0.90 if personal_num else 0.0, "MRZ"),
        "marital_status": build_field(None, 0.0, "visual_text")
    }

# ----------------- AADHAAR EXTRACTOR -----------------
def extract_aadhaar(raw_text: str, blocks: List[Dict[str, Any]], qr_data: Optional[str] = None) -> Dict[str, Any]:
    text = (raw_text or "").upper()
    
    # 1. 12-digit Aadhaar Number (XXXX XXXX XXXX or XXXXXXXXXXXX)
    aadhaar_num = None
    aadhaar_bbox = None
    aadhaar_valid = False
    
    # Search formatted 4-4-4
    m = re.search(r"\b([2-9]\d{3}\s\d{4}\s\d{4})\b", text)
    if not m:
        m = re.search(r"\b([2-9]\d{11})\b", text)
        
    if m:
        digits = re.sub(r"\D", "", m.group(1))
        aadhaar_valid = is_valid_aadhaar_checksum(digits)
        # Format as XXXX XXXX XXXX
        aadhaar_num = f"{digits[:4]} {digits[4:8]} {digits[8:]}"
        aadhaar_bbox = find_block_bbox(blocks, r"\b[2-9]\d{3}\s?\d{4}\s?\d{4}\b")

    # 2. Name
    # Usually appears right above DOB or Father's Name
    name = None
    name_lines = []
    lines = [b.get("text", "").strip() for b in blocks if len(b.get("text", "").strip()) > 3]
    for i, line in enumerate(lines):
        if re.search(r"(?:DOB|DATE\s*OF\s*BIRTH|YEAR\s*OF\s*BIRTH|YOB)", line, re.IGNORECASE):
            if i > 0:
                prev = lines[i-1]
                if not re.search(r"(?:GOVERNMENT|INDIA|AUTHORITY|AADHAAR|MERA)", prev, re.IGNORECASE):
                    name = prev
            break
            
    # 3. DOB / YOB
    dob_norm = None
    dob_raw = None
    dob_m = re.search(r"(?:DOB|DATE\s*OF\s*BIRTH)\s*[:/-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})", text)
    if dob_m:
        dob_norm, dob_raw = normalize_date(dob_m.group(1))
    else:
        yob_m = re.search(r"(?:YEAR\s*OF\s*BIRTH|YOB)\s*[:/-]?\s*(\d{4})", text)
        if yob_m:
            dob_norm = f"{yob_m.group(1)}-01-01"
            dob_raw = yob_m.group(1)

    # 4. Gender
    gender = None
    if re.search(r"\bFEMALE\b", text):
        gender = "FEMALE"
    elif re.search(r"\bMALE\b", text):
        gender = "MALE"
    elif re.search(r"\bTRANSGENDER\b", text):
        gender = "TRANSGENDER"

    # 5. Guardian / Father / Husband (S/O, D/O, W/O, C/O)
    guardian = None
    care_of_m = re.search(r"\b(?:C/O|S/O|D/O|W/O)\s*[:/-]?\s*([A-Z' -]{2,35})", text)
    if care_of_m:
        guardian = care_of_m.group(1).strip()

    # QR Code cross-check
    qr_aadhaar_match = False
    if qr_data:
        # Secure Aadhaar QR code contains XML or encoded data
        if aadhaar_num and re.sub(r"\D", "", aadhaar_num) in qr_data:
            qr_aadhaar_match = True

    return {
        "aadhaar_number": build_field(
            aadhaar_num,
            0.99 if (aadhaar_num and aadhaar_valid) else (0.80 if aadhaar_num else 0.0),
            source="visual_text",
            bbox=aadhaar_bbox,
            status="Verified" if aadhaar_valid else ("Needs verification" if aadhaar_num else "Not detected"),
            validation="valid" if aadhaar_valid else ("checksum_failed" if aadhaar_num else "unverified")
        ),
        "full_name": build_field(name, 0.88 if name else 0.0, "visual_text"),
        "date_of_birth": build_field(dob_norm, 0.95 if dob_norm else 0.0, "visual_text", raw_value=dob_raw),
        "gender": build_field(gender, 0.96 if gender else 0.0, "visual_text"),
        "guardian_name": build_field(guardian, 0.85 if guardian else 0.0, "visual_text"),
        "nationality": build_field("India", 0.99, "visual_text", raw_value="IND"),
        "qr_code_detected": build_field("Detected" if qr_data else None, 0.99 if qr_data else 0.0, "QR_code")
    }

# ----------------- PAN CARD EXTRACTOR -----------------
def extract_pan(raw_text: str, blocks: List[Dict[str, Any]], qr_data: Optional[str] = None) -> Dict[str, Any]:
    text = (raw_text or "").upper()
    
    # 1. PAN Number: 10 alphanumeric [A-Z]{5}[0-9]{4}[A-Z]
    pan_num = None
    pan_bbox = None
    pan_match = re.search(r"\b([A-Z]{5}[0-9]{4}[A-Z])\b", text)
    if pan_match:
        pan_num = pan_match.group(1)
        pan_bbox = find_block_bbox(blocks, r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")
    else:
        # Check potential OCR character confusions in PAN pattern (e.g. O instead of 0 or vice versa)
        cand_match = re.search(r"\b([A-Z0-9]{10})\b", text)
        if cand_match:
            cand = cand_match.group(1)
            # 5 letters, 4 digits, 1 letter
            alpha_part1 = disambiguate_alpha(cand[:5])
            digit_part = disambiguate_numeric(cand[5:9])
            alpha_part2 = disambiguate_alpha(cand[9:10])
            reconstructed = f"{alpha_part1}{digit_part}{alpha_part2}"
            if re.fullmatch(r"[A-Z]{5}[0-9]{4}[A-Z]", reconstructed):
                pan_num = reconstructed
                pan_bbox = find_block_bbox(blocks, cand)

    # 4th letter entity type: P=Individual, C=Company, H=HUF, A=AOP, T=Trust, F=Firm, G=Govt
    entity_types = {
        "P": "Individual", "C": "Company", "H": "Hindu Undivided Family",
        "A": "Association of Persons", "T": "Trust", "F": "Firm", "G": "Government Agency"
    }
    entity_type = entity_types.get(pan_num[3], "Other") if pan_num and len(pan_num) >= 4 else None

    # 2. DOB
    dob_norm, dob_raw = None, None
    dob_m = re.search(r"(\d{2}[/.-]\d{2}[/.-]\d{4})", text)
    if dob_m:
        dob_norm, dob_raw = normalize_date(dob_m.group(1))

    # 3. Name & Father's Name
    name = None
    father_name = None
    lines = [b.get("text", "").strip() for b in blocks if len(b.get("text", "").strip()) > 3]
    for i, line in enumerate(lines):
        if re.search(r"FATHER'?S\s*NAME", line, re.IGNORECASE):
            if i + 1 < len(lines):
                father_name = lines[i+1]
            if i > 0 and not re.search(r"INCOME\s*TAX|GOVT|INDIA|PERMANENT", lines[i-1], re.IGNORECASE):
                name = lines[i-1]
            break

    return {
        "pan_number": build_field(
            pan_num,
            0.98 if pan_num else 0.0,
            "visual_text",
            bbox=pan_bbox,
            status="Verified" if pan_num else "Not detected",
            validation="valid" if pan_num else "unverified"
        ),
        "entity_type": build_field(entity_type, 0.95 if entity_type else 0.0, "document_layout"),
        "full_name": build_field(name, 0.87 if name else 0.0, "visual_text"),
        "father_name": build_field(father_name, 0.85 if father_name else 0.0, "visual_text"),
        "date_of_birth": build_field(dob_norm, 0.95 if dob_norm else 0.0, "visual_text", raw_value=dob_raw),
        "issuing_authority": build_field("Income Tax Department, Govt. of India", 0.99, "visual_text"),
        "nationality": build_field("India", 0.99, "visual_text", raw_value="IND")
    }

# ----------------- DRIVING LICENCE EXTRACTOR -----------------
def extract_driving_licence(raw_text: str, blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    text = (raw_text or "").upper()
    
    # 1. DL Number (e.g. TN3720250004774 or DL-0420110012345 or KA01 20110001234 or RJ1420180001234)
    dl_num = None
    dl_bbox = None
    m = re.search(r"\b([A-Z]{2}[- ]?[0-9]{2}[- ]?[0-9]{4}[- ]?[0-9]{7})\b", text)
    if not m:
        m = re.search(r"\b([A-Z]{2}[0-9]{13,15})\b", text.replace("-", "").replace(" ", ""))
    if not m:
        m = re.search(r"\b([A-Z]{2}[- ]?[0-9]{2}[- ]?[0-9]{11})\b", text)
    if m:
        dl_num = m.group(1).replace(" ", "").replace("-", "")
        dl_bbox = find_block_bbox(blocks, r"\b[A-Z]{2}[- ]?[0-9]{2}")

    # 2. Dates - Parse all date occurrences and assign chronologically
    # Indian DLs contain DOB, Issue Date, and Validity (NT/TR) Expiry Date
    dob_norm, dob_raw = None, None
    issue_norm, issue_raw = None, None
    exp_norm, exp_raw = None, None

    # Step A: Look for explicit regex matches with labels
    dob_m = re.search(r"(?:DOB|DATE\s*OF\s*BIRTH|BIRTH\s*DATE)\s*[:/-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})", text)
    if dob_m:
        dob_norm, dob_raw = normalize_date(dob_m.group(1))

    issue_m = re.search(r"(?:ISSUE\s*DATE|DATE\s*OF\s*ISSUE|DOI|ISSUED\s*ON|DATEF\s*SSUE)\s*[:/-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})", text)
    if issue_m:
        issue_norm, issue_raw = normalize_date(issue_m.group(1))

    exp_m = re.search(r"(?:VALIDITY\s*\(NT\)|VALIDITY\s*\(TR\)|VALIDITY|VALID\s*TILL|EXPIRY|EXP|VALID\s*UPTO)\s*[:/-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})", text)
    if exp_m:
        exp_norm, exp_raw = normalize_date(exp_m.group(1))

    # Step B: Chronological date resolution across all dates found in text & blocks
    all_date_strings = re.findall(r"\b(\d{2}[/.-]\d{2}[/.-]\d{4})\b", text)
    for b in blocks:
        b_dates = re.findall(r"\b(\d{2}[/.-]\d{2}[/.-]\d{4})\b", b.get("text", ""))
        all_date_strings.extend(b_dates)

    parsed_dates = []
    seen_dates = set()
    for ds in all_date_strings:
        n_dt, r_dt = normalize_date(ds)
        if n_dt and n_dt not in seen_dates:
            try:
                dt_obj = datetime.strptime(n_dt, "%Y-%m-%d")
                parsed_dates.append((n_dt, r_dt, dt_obj))
                seen_dates.add(n_dt)
            except Exception:
                pass

    # Sort parsed dates in chronological order
    parsed_dates.sort(key=lambda x: x[2])

    # Enforce physical chronological reality: DOB < Issue Date < Expiry Date
    if len(parsed_dates) >= 3:
        # Earliest date is strictly DOB
        dob_norm, dob_raw = parsed_dates[0][0], parsed_dates[0][1]
        # Latest date (future e.g. 2045-2050) is strictly Expiry Date
        exp_norm, exp_raw = parsed_dates[-1][0], parsed_dates[-1][1]
        # Intermediate date is strictly Issue Date
        issue_norm, issue_raw = parsed_dates[1][0], parsed_dates[1][1]
    elif len(parsed_dates) == 2:
        if not dob_norm:
            dob_norm, dob_raw = parsed_dates[0][0], parsed_dates[0][1]
        if not exp_norm:
            exp_norm, exp_raw = parsed_dates[1][0], parsed_dates[1][1]

    # 3. Blood Group
    # Match 'Blood Group: A+', 'Blod Group: B+', 'BG: O+', or standalone 'A+', 'B+', etc.
    blood_group = None
    bg_m = re.search(r"(?:BL[OO]+D\s*GROUP|BG)\s*[:/-]?\s*([ABO0][+-]|\b(?:A|B|AB|O)\s*[+-]|\b(?:A|B|AB|O)\s*(?:POS|NEG|POSITIVE|NEGATIVE|\+VE|\-VE)\b)", text, re.IGNORECASE)
    if bg_m:
        bg_raw = bg_m.group(1).upper().replace(" ", "").replace("0+", "O+").replace("0-", "O-")
        if "+VE" in bg_raw or "POS" in bg_raw or "+" in bg_raw:
            blood_group = bg_raw.replace("+VE", "+").replace("POSITIVE", "+").replace("POS", "+")
        elif "-VE" in bg_raw or "NEG" in bg_raw or "-" in bg_raw:
            blood_group = bg_raw.replace("-VE", "-").replace("NEGATIVE", "-").replace("NEG", "-")
        else:
            blood_group = bg_raw
    else:
        standalone_bg = re.search(r"(?:^|[\s,;:])(A|B|AB|O)\s*([+-])(?=[^A-Za-z0-9]|$)", text)
        if standalone_bg:
            blood_group = f"{standalone_bg.group(1)}{standalone_bg.group(2)}"

    # 4. Name Extraction (Spatial blocks and bounded regex)
    name = None
    # Method A: Search spatial blocks
    for i, b in enumerate(blocks):
        b_txt = b.get("text", "").strip()
        if re.match(r"^NAME\s*[:/-]?$", b_txt, re.IGNORECASE):
            if i + 1 < len(blocks):
                candidate = blocks[i + 1].get("text", "").strip()
                if candidate and not re.search(r"(?:DATE|DOB|BIRTH|SON|DAUGHTER|BLOOD|SIGNATURE)", candidate, re.IGNORECASE):
                    name = candidate
                    break
        elif re.match(r"^NAME\s*[:/-]?\s+([A-Z' . -]{2,40})$", b_txt, re.IGNORECASE):
            name = re.sub(r"^NAME\s*[:/-]?\s*", "", b_txt, flags=re.IGNORECASE).strip()
            break

    # Method B: Regex on text with strict boundary delimiters
    if not name:
        name_m = re.search(r"\bNAME\s*[:/-]?\s*([A-Z' . -]{2,35})", text)
        if name_m:
            candidate = name_m.group(1).strip()
            for stop in ["DATE", "DOB", "BIRTH", "ORGAN", "DONOR", "SON", "DAUGHTER", "WIFE", "S/O", "D/O", "W/O", "BLOOD", "ADDRESS", "HOLDER", "SIGNATURE", "VALIDITY"]:
                if stop in candidate:
                    candidate = candidate.split(stop)[0].strip(" :-/")
            if len(candidate) >= 2:
                name = candidate

    # Clean name of any trailing noise
    if name:
        name = re.sub(r"\b(?:ORGAN|DONOR|HOLDER|SIGNATURE|DATEF|SSUE|ISSUE)\b.*$", "", name, flags=re.IGNORECASE).strip(" :-/")

    # 5. Father's / Guardian's Name
    father_name = None
    for i, b in enumerate(blocks):
        b_txt = b.get("text", "").strip()
        if re.search(r"(?:SON|DAUGHTER|WIFE)\s*OF\s*[:/-]?", b_txt, re.IGNORECASE):
            if i + 1 < len(blocks):
                candidate = blocks[i + 1].get("text", "").strip()
                if candidate and not re.search(r"(?:ADDRESS|DOB|BLOOD)", candidate, re.IGNORECASE):
                    father_name = candidate
                    break
    if not father_name:
        father_m = re.search(r"(?:SON|DAUGHTER|WIFE)\s*OF\s*[:/-]?\s*([A-Z' . -]{2,35})", text)
        if father_m:
            candidate = father_m.group(1).strip()
            for stop in ["ADDRESS", "DOB", "BLOOD", "DATE", "PIN"]:
                if stop in candidate:
                    candidate = candidate.split(stop)[0].strip(" :-/")
            father_name = candidate

    # 6. Authorized Vehicle Classes
    cov = []
    for cls in ["MCWG", "LMV", "TRANS", "3W-NT", "HMV", "MCWOG", "HGMV", "HPMV"]:
        if re.search(rf"\b{cls}\b", text):
            cov.append(cls)
    vehicle_classes = ", ".join(cov) if cov else None

    # 7. Organ Donor & Address
    organ_donor = None
    od_m = re.search(r"ORGAN\s*DONOR\s*[:/-]?\s*([YN]|YES|NO)", text)
    if od_m:
        organ_donor = "Yes" if od_m.group(1).upper() in ["Y", "YES"] else "No"

    return {
        "licence_number": build_field(dl_num, 0.98 if dl_num else 0.0, "visual_text", bbox=dl_bbox),
        "full_name": build_field(name, 0.95 if name else 0.0, "visual_text"),
        "father_name": build_field(father_name, 0.92 if father_name else 0.0, "visual_text"),
        "date_of_birth": build_field(dob_norm, 0.98 if dob_norm else 0.0, "visual_text", raw_value=dob_raw),
        "date_of_issue": build_field(issue_norm, 0.95 if issue_norm else 0.0, "visual_text", raw_value=issue_raw),
        "date_of_expiry": build_field(exp_norm, 0.98 if exp_norm else 0.0, "visual_text", raw_value=exp_raw),
        "blood_group": build_field(blood_group, 0.95 if blood_group else 0.0, "visual_text"),
        "vehicle_classes": build_field(vehicle_classes, 0.90 if vehicle_classes else 0.0, "visual_text"),
        "organ_donor": build_field(organ_donor, 0.90 if organ_donor else 0.0, "visual_text"),
        "issuing_authority": build_field("Transport Department", 0.90, "visual_text")
    }

# ----------------- VOTER ID EXTRACTOR -----------------
def extract_voter_id(raw_text: str, blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    text = (raw_text or "").upper()
    
    # 1. EPIC Number (3 letters followed by 7 digits, e.g. ABC1234567)
    epic_num = None
    epic_bbox = None
    m = re.search(r"\b([A-Z]{3}[0-9]{7})\b", text)
    if m:
        epic_num = m.group(1)
        epic_bbox = find_block_bbox(blocks, r"\b[A-Z]{3}[0-9]{7}\b")

    # 2. Name
    name_m = re.search(r"(?:ELECTOR'?S?\s*NAME|NAME)\s*[:/-]?\s*([A-Z' -]{2,35})", text)
    name = name_m.group(1).strip() if name_m else None

    # 3. Father's / Husband's Name
    rel_m = re.search(r"(?:FATHER'?S?\s*NAME|HUSBAND'?S?\s*NAME|RELATION'?S?\s*NAME)\s*[:/-]?\s*([A-Z' -]{2,35})", text)
    rel_name = rel_m.group(1).strip() if rel_m else None

    # 4. Gender
    gender = "FEMALE" if "FEMALE" in text else ("MALE" if "MALE" in text else None)

    # 5. DOB or Age
    dob_norm, dob_raw = None, None
    dob_m = re.search(r"(?:DOB|DATE\s*OF\s*BIRTH)\s*[:/-]?\s*(\d{2}[/.-]\d{2}[/.-]\d{4})", text)
    if dob_m:
        dob_norm, dob_raw = normalize_date(dob_m.group(1))
    else:
        age_m = re.search(r"\bAGE\s*[:/-]?\s*(\d{1,2})\b", text)
        if age_m:
            dob_raw = f"Age: {age_m.group(1)}"

    return {
        "voter_id_number": build_field(epic_num, 0.97 if epic_num else 0.0, "visual_text", bbox=epic_bbox),
        "full_name": build_field(name, 0.88 if name else 0.0, "visual_text"),
        "relative_name": build_field(rel_name, 0.85 if rel_name else 0.0, "visual_text"),
        "gender": build_field(gender, 0.95 if gender else 0.0, "visual_text"),
        "date_of_birth": build_field(dob_norm, 0.92 if dob_norm else 0.0, "visual_text", raw_value=dob_raw),
        "issuing_authority": build_field("Election Commission of India", 0.99, "visual_text"),
        "nationality": build_field("India", 0.99, "visual_text", raw_value="IND")
    }

# ----------------- GENERAL / UNKNOWN EXTRACTOR -----------------
def extract_general_document(raw_text: str, blocks: List[Dict[str, Any]]) -> Dict[str, Any]:
    text = (raw_text or "").upper()
    dates = re.findall(r"\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b", text)
    norm_dates = [normalize_date(d)[0] for d in dates if normalize_date(d)[0]]
    
    # Generic document numbers (alphanumeric strings >= 7 chars)
    id_matches = re.findall(r"\b[A-Z0-9]{7,15}\b", text)
    doc_id = id_matches[0] if id_matches else None
    
    return {
        "document_identifier": build_field(doc_id, 0.75 if doc_id else 0.0, "OCR"),
        "primary_date": build_field(norm_dates[0] if norm_dates else None, 0.80 if norm_dates else 0.0, "OCR"),
        "text_summary": build_field(text[:120] if text else None, 0.85 if text else 0.0, "OCR")
    }

def extract_document_fields(
    doc_type: str,
    raw_text: str,
    blocks: List[Dict[str, Any]],
    mrz_data: Dict[str, Any],
    qr_bar_data: Dict[str, Any]
) -> Dict[str, Any]:
    """Routes to the document-specific extractor and produces a uniform schema."""
    t = doc_type.upper()
    qr_content = qr_bar_data.get("qr_data")
    
    if "PASSPORT" in t:
        return extract_passport(raw_text, blocks, mrz_data)
    elif "AADHAAR" in t or "AADHAR" in t:
        return extract_aadhaar(raw_text, blocks, qr_content)
    elif "PAN" in t:
        return extract_pan(raw_text, blocks, qr_content)
    elif "DRIV" in t or "LICEN" in t:
        return extract_driving_licence(raw_text, blocks)
    elif "VOTER" in t or "EPIC" in t:
        return extract_voter_id(raw_text, blocks)
    else:
        # Check if MRZ is present anyway
        if mrz_data.get("valid"):
            return extract_passport(raw_text, blocks, mrz_data)
        return extract_general_document(raw_text, blocks)
