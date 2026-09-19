# app/modules/cross_validator.py
import re
from typing import Dict, Any, List, Optional

def normalize_name_for_comparison(name: Optional[str]) -> str:
    """Strips titles, punctuation, extra spaces for fuzzy matching."""
    if not name:
        return ""
    s = name.upper()
    s = re.sub(r"[^A-Z]", " ", s)
    tokens = [t for t in s.split() if t not in {"MR", "MRS", "MS", "DR", "MASTER"}]
    return " ".join(tokens)

def dates_match(d1: Optional[str], d2: Optional[str]) -> bool:
    """Compares two date strings, checking both ISO and YYMMDD forms."""
    if not d1 or not d2:
        return False
    c1 = re.sub(r"\D", "", d1)
    c2 = re.sub(r"\D", "", d2)
    if c1 == c2:
        return True
    # If one is 8 digits (YYYYMMDD) and one is 6 digits (YYMMDD)
    if len(c1) == 8 and len(c2) == 6 and c1[2:] == c2:
        return True
    if len(c2) == 8 and len(c1) == 6 and c2[2:] == c1:
        return True
    return False

def strings_match(s1: Optional[str], s2: Optional[str]) -> bool:
    """Case-insensitive alphanumeric comparison."""
    if not s1 or not s2:
        return False
    c1 = re.sub(r"[^A-Z0-9]", "", str(s1).upper())
    c2 = re.sub(r"[^A-Z0-9]", "", str(s2).upper())
    return c1 == c2

def nationality_matches(visual_nat: Optional[str], mrz_nat: Optional[str]) -> bool:
    """Matches nationality code vs full country name (e.g. IND vs India/Indian)."""
    if not visual_nat or not mrz_nat:
        return False
    v = visual_nat.upper()
    m = mrz_nat.upper()
    if v == m:
        return True
    if m == "IND" and any(ind in v for ind in ["IND", "INDIA", "INDIAN"]):
        return True
    if v == "IND" and any(ind in m for ind in ["IND", "INDIA", "INDIAN"]):
        return True
    return False

def perform_cross_validation(
    fields: Dict[str, Any],
    mrz_data: Dict[str, Any],
    qr_data: Optional[str] = None
) -> Dict[str, Any]:
    """
    Performs cross-validation across document sources:
    - Visual text vs MRZ
    - Visual text vs QR / Barcode
    Returns comparison list and overall status.
    """
    comparisons = []
    has_mismatch = False
    
    parsed_mrz = mrz_data.get("parsed_fields", {})
    mrz_lines = mrz_data.get("raw_mrz", [])
    has_mrz = bool(parsed_mrz or mrz_lines)
    
    # 1. Passport Number Cross-Check
    if has_mrz and "passport_number" in fields:
        vis_num = fields["passport_number"].get("raw_value") or fields["passport_number"].get("value")
        mrz_num = parsed_mrz.get("document_number")
        if vis_num and mrz_num:
            matched = strings_match(vis_num, mrz_num)
            if not matched:
                has_mismatch = True
            comparisons.append({
                "field": "Passport Number",
                "visual_value": vis_num,
                "mrz_value": mrz_num,
                "status": "✓ Matched" if matched else "⚠️ Mismatch detected",
                "matched": matched
            })

    # 2. Date of Birth Cross-Check
    if has_mrz and "date_of_birth" in fields:
        vis_dob = fields["date_of_birth"].get("raw_value") or fields["date_of_birth"].get("value")
        mrz_dob = parsed_mrz.get("birth_date")
        if vis_dob and mrz_dob:
            matched = dates_match(vis_dob, mrz_dob)
            if not matched:
                has_mismatch = True
            comparisons.append({
                "field": "Date of Birth",
                "visual_value": fields["date_of_birth"].get("value"),
                "mrz_value": mrz_dob,
                "status": "✓ Matched" if matched else "⚠️ Mismatch detected",
                "matched": matched
            })

    # 3. Expiry Date Cross-Check
    if has_mrz and "date_of_expiry" in fields:
        vis_exp = fields["date_of_expiry"].get("raw_value") or fields["date_of_expiry"].get("value")
        mrz_exp = parsed_mrz.get("expiry_date")
        if vis_exp and mrz_exp:
            matched = dates_match(vis_exp, mrz_exp)
            if not matched:
                has_mismatch = True
            comparisons.append({
                "field": "Date of Expiry",
                "visual_value": fields["date_of_expiry"].get("value"),
                "mrz_value": mrz_exp,
                "status": "✓ Matched" if matched else "⚠️ Mismatch detected",
                "matched": matched
            })

    # 4. Nationality Cross-Check
    if has_mrz and "nationality" in fields:
        vis_nat = fields["nationality"].get("value")
        mrz_nat = parsed_mrz.get("nationality")
        if vis_nat and mrz_nat:
            matched = nationality_matches(vis_nat, mrz_nat)
            if not matched:
                has_mismatch = True
            comparisons.append({
                "field": "Nationality",
                "visual_value": vis_nat,
                "mrz_value": mrz_nat,
                "status": "✓ Matched" if matched else "⚠️ Mismatch detected",
                "matched": matched
            })

    # 5. Name Cross-Check
    if has_mrz:
        vis_surname = fields.get("surname", {}).get("value")
        mrz_surname = parsed_mrz.get("surname")
        if vis_surname and mrz_surname:
            matched = strings_match(vis_surname, mrz_surname)
            if not matched:
                has_mismatch = True
            comparisons.append({
                "field": "Surname",
                "visual_value": vis_surname,
                "mrz_value": mrz_surname,
                "status": "✓ Matched" if matched else "⚠️ Mismatch detected",
                "matched": matched
            })

    # 6. QR Code Cross-Check (e.g. Aadhaar or PAN)
    if qr_data:
        if "aadhaar_number" in fields:
            num = fields["aadhaar_number"].get("value")
            if num:
                clean_num = re.sub(r"\D", "", num)
                matched = clean_num in qr_data
                comparisons.append({
                    "field": "Aadhaar / QR Match",
                    "visual_value": num,
                    "mrz_value": "QR Data Verified" if matched else "Not found in QR",
                    "status": "✓ Matched" if matched else "⚠️ Mismatch detected",
                    "matched": matched
                })

    overall_status = "VERIFIED" if (comparisons and not has_mismatch) else ("MISMATCH" if has_mismatch else "NO_CROSS_SOURCE")
    return {
        "status": overall_status,
        "has_mismatch": has_mismatch,
        "comparisons": comparisons,
        "total_checks": len(comparisons),
        "passed_checks": sum(1 for c in comparisons if c["matched"])
    }
