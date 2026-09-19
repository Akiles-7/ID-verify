# app/modules/mrz_and_checksum.py
WEIGHTS = [7, 3, 1]

def char_value(c: str) -> int:
    """ICAO 9303 character numeric mapping: 0-9 -> 0-9; A-Z -> 10-35; < -> 0."""
    if c.isdigit():
        return int(c)
    if c == '<':
        return 0
    if 'A' <= c.upper() <= 'Z':
        return ord(c.upper()) - ord('A') + 10
    return 0

def universal_weight_731(field: str) -> int:
    """Computes the standard ICAO 9303 7-3-1 weighted modulo-10 check digit for any string."""
    total = sum(char_value(c) * WEIGHTS[i % 3] for i, c in enumerate(field))
    return total % 10

def compute_check_digit(field: str) -> int:
    return universal_weight_731(field)

def validate_field_checksum(field_str: str, stored_digit_str: str, check_name: str) -> dict:
    computed = universal_weight_731(field_str)
    stored = int(stored_digit_str) if stored_digit_str.isdigit() else -1
    passed = (computed == stored)
    return {
        "check_group": "CHECKSUM",
        "check_name": check_name,
        "passed": passed,
        "computed_value": str(computed),
        "stored_value": str(stored),
        "detail": f"Computed: {computed} · Stored: {stored}" + (" ✓" if passed else " — MISMATCH")
    }

def is_plausible_mrz_line(line: str, expected_len: int = 44, tolerance: int = 4) -> bool:
    """Filters candidate MRZ lines by checking length and ICAO character set compliance."""
    if not (expected_len - tolerance <= len(line) <= expected_len + tolerance):
        return False
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<")
    non_compliant = sum(1 for c in line.upper() if c not in allowed)
    return non_compliant <= 3

def _lines_match_td1(lines: list) -> bool:
    return len(lines) == 3 and all(28 <= len(l) <= 32 for l in lines)

def _lines_match_td2(lines: list) -> bool:
    return len(lines) == 2 and all(34 <= len(l) <= 38 for l in lines)

def _yyMMdd_to_iso(yyMMdd: str) -> str:
    if len(yyMMdd) != 6 or not yyMMdd.isdigit():
        return "UNKNOWN"
    yy = int(yyMMdd[0:2])
    mm = yyMMdd[2:4]
    dd = yyMMdd[4:6]
    year = 2000 + yy if yy <= 30 else 1900 + yy
    return f"{year}-{mm}-{dd}"

COUNTRY_NAMES = {
    "POL": "Poland", "IND": "India", "USA": "United States", "GBR": "United Kingdom",
    "DEU": "Germany", "FRA": "France", "CHN": "China", "JPN": "Japan",
    "AUS": "Australia", "CAN": "Canada", "RUS": "Russia", "BRA": "Brazil", "ESP": "Spain"
}

def looks_structurally_like_td3_mrz(l1: str, l2: str) -> bool:
    """Cheap structural pre-check before trusting a TD3 (44-char) MRZ candidate pair."""
    if len(l1) != 44 or len(l2) != 44:
        return False
    if l1[0] not in "PIACV":
        return False
    country = l1[2:5]
    if not (country.isalpha() or country == "<<<"):
        return False
    if "<<" not in l1[5:]:
        return False
    nationality = l2[10:13]
    if not (nationality.isalpha() or nationality == "<<<"):
        return False
    if l2[20:21] not in ("M", "F", "<"):
        return False
    if not l2[13:19].replace("<", "0").isdigit():
        return False
    if not l2[21:27].replace("<", "0").isdigit():
        return False
    return True

def looks_structurally_like_td2_mrz(l1: str, l2: str) -> bool:
    """Cheap structural pre-check for TD2 (36-char) MRZ candidate pair."""
    if len(l1) != 36 or len(l2) != 36:
        return False
    if l1[0] not in "IVACD":
        return False
    if "<<" not in l1[5:]:
        return False
    if not l2[13:19].replace("<", "0").isdigit():
        return False
    if not l2[21:27].replace("<", "0").isdigit():
        return False
    return True

def looks_structurally_like_td1_mrz(l1: str, l2: str, l3: str) -> bool:
    """Cheap structural pre-check for TD1 (3x30-char) MRZ candidate tuple."""
    if len(l1) != 30 or len(l2) != 30 or len(l3) != 30:
        return False
    if l1[0] not in "IACD":
        return False
    if not l2[0:6].replace("<", "0").isdigit():
        return False
    if not l2[8:14].replace("<", "0").isdigit():
        return False
    return True

def parse_mrz(lines: list) -> dict:
    """Polymorphic MRZ Router: Auto-detects TD1 (3x30), TD2 (2x36), or TD3 (2x44) document layouts."""
    cleaned = [l.strip().upper().replace(' ', '<') for l in lines if l.strip()]
    if not cleaned:
        return _empty_mrz_result()

    # -------------------------------------------------------------------------
    # ROUTE 1: TD1 Identity Cards (3 Rows x 30 Chars)
    # -------------------------------------------------------------------------
    if _lines_match_td1(cleaned):
        r1 = cleaned[0].ljust(30, '<')[:30]
        r2 = cleaned[1].ljust(30, '<')[:30]
        r3 = cleaned[2].ljust(30, '<')[:30]

        if not looks_structurally_like_td1_mrz(r1, r2, r3):
            return _empty_mrz_result()

        issuing_country = r1[2:5].replace('<', '').strip()
        doc_number = r1[5:14].replace('<', '').strip()
        doc_check = r1[14:15]

        dob_str = r2[0:6]
        dob_check = r2[6:7]
        sex = r2[7:8]
        expiry_str = r2[8:14]
        expiry_check = r2[14:15]
        nationality = r2[15:18].replace('<', '').strip()

        names_part = r3.replace('<', ' ').strip()
        parts = names_part.split('  ', 1)
        surname = parts[0].strip() if len(parts) > 0 else names_part
        given_names = parts[1].strip() if len(parts) > 1 else ""

        nat_disp = f"{nationality} — {COUNTRY_NAMES.get(nationality, nationality)}" if nationality in COUNTRY_NAMES else nationality

        return {
            "layout_format": "TD1_IDENTITY_CARD",
            "surname": surname or "UNREADABLE",
            "given_names": given_names or "UNREADABLE",
            "document_number": doc_number or "UNREADABLE",
            "nationality": nat_disp,
            "date_of_birth": _yyMMdd_to_iso(dob_str),
            "sex": sex if sex in ('M', 'F') else "UNKNOWN",
            "expiry_date": _yyMMdd_to_iso(expiry_str),
            "issuing_country": issuing_country or "UNKNOWN",
            "personal_number": "N/A",
            "mrz_line1": r1, "mrz_line2": r2, "mrz_line3": r3,
            "_doc_number_raw": doc_number, "_doc_check": doc_check,
            "_dob_raw": dob_str, "_dob_check": dob_check,
            "_expiry_raw": expiry_str, "_expiry_check": expiry_check,
            "_personal_raw": "", "_personal_check": "0",
            "_composite_raw": r1[5:30] + r2[0:7] + r2[8:15],
            "_composite_check": r2[29:30] if len(r2) >= 30 else "0"
        }

    # -------------------------------------------------------------------------
    # ROUTE 2: TD2 Official IDs / Visas (2 Rows x 36 Chars)
    # -------------------------------------------------------------------------
    elif _lines_match_td2(cleaned):
        r1 = cleaned[0].ljust(36, '<')[:36]
        r2 = cleaned[1].ljust(36, '<')[:36]

        if not looks_structurally_like_td2_mrz(r1, r2):
            return _empty_mrz_result()

        doc_type = "VISA_TD2" if r1.startswith("V") else "OFFICIAL_ID_TD2"
        issuing_country = r1[2:5].replace('<', '').strip()
        names_part = r1[5:]
        surname_raw, given_raw = names_part.split('<<', 1) if '<<' in names_part else (names_part, "")
        surname = surname_raw.replace('<', ' ').strip()
        given_names = given_raw.replace('<', ' ').strip()

        doc_number = r2[0:9].replace('<', '').strip()
        doc_check = r2[9:10]
        nationality = r2[10:13].replace('<', '').strip()
        dob_str = r2[13:19]
        dob_check = r2[19:20]
        sex = r2[20:21]
        expiry_str = r2[21:27]
        expiry_check = r2[27:28]

        nat_disp = f"{nationality} — {COUNTRY_NAMES.get(nationality, nationality)}" if nationality in COUNTRY_NAMES else nationality

        return {
            "layout_format": doc_type,
            "surname": surname or "UNREADABLE",
            "given_names": given_names or "UNREADABLE",
            "document_number": doc_number or "UNREADABLE",
            "nationality": nat_disp,
            "date_of_birth": _yyMMdd_to_iso(dob_str),
            "sex": sex if sex in ('M', 'F') else "UNKNOWN",
            "expiry_date": _yyMMdd_to_iso(expiry_str),
            "issuing_country": issuing_country or "UNKNOWN",
            "personal_number": "N/A",
            "mrz_line1": r1, "mrz_line2": r2,
            "_doc_number_raw": doc_number, "_doc_check": doc_check,
            "_dob_raw": dob_str, "_dob_check": dob_check,
            "_expiry_raw": expiry_str, "_expiry_check": expiry_check,
            "_personal_raw": "", "_personal_check": "0",
            "_composite_raw": r2[0:10] + r2[13:20] + r2[21:35],
            "_composite_check": r2[35:36]
        }

    # -------------------------------------------------------------------------
    # ROUTE 3: TD3 Passports / Visas (2 Rows x 44 Chars) — Defensively checked
    # -------------------------------------------------------------------------
    else:
        td3_lines = cleaned[:2]
        l1 = (td3_lines[0] if len(td3_lines) > 0 else "").ljust(44, '<')[:44]
        l2 = (td3_lines[1] if len(td3_lines) > 1 else "").ljust(44, '<')[:44]

        # Gate with structural MRZ sanity check
        if not looks_structurally_like_td3_mrz(l1, l2):
            return _empty_mrz_result()

        doc_type = "VISA_TD3" if l1.startswith("V") else "PASSPORT_TD3"
        issuing_country = l1[2:5].replace('<', '').strip()
        names_part = l1[5:]
        surname_raw, given_raw = names_part.split('<<', 1) if '<<' in names_part else (names_part, "")
        surname = surname_raw.replace('<', ' ').strip() or "UNREADABLE"
        given_names = given_raw.replace('<', ' ').strip() or "UNREADABLE"

        doc_number = l2[0:9].replace('<', '').strip() or "UNREADABLE"
        doc_check = l2[9:10]
        nationality = l2[10:13].replace('<', '').strip() or "UNKNOWN"
        dob_str = l2[13:19]
        dob_check = l2[19:20]
        sex = l2[20:21]
        expiry_str = l2[21:27]
        expiry_check = l2[27:28]
        personal_number = l2[28:42].replace('<', '').strip() or "UNKNOWN"
        personal_check = l2[42:43]
        composite_check = l2[43:44]

        nat_disp = f"{nationality} — {COUNTRY_NAMES.get(nationality, nationality)}" if nationality in COUNTRY_NAMES else nationality

        return {
            "layout_format": doc_type,
            "surname": surname,
            "given_names": given_names,
            "document_number": doc_number,
            "nationality": nat_disp,
            "date_of_birth": _yyMMdd_to_iso(dob_str),
            "sex": sex if sex in ('M', 'F') else "UNKNOWN",
            "expiry_date": _yyMMdd_to_iso(expiry_str),
            "issuing_country": issuing_country or "UNKNOWN",
            "personal_number": personal_number,
            "mrz_line1": l1,
            "mrz_line2": l2,
            "_doc_number_raw": doc_number,
            "_doc_check": doc_check,
            "_dob_raw": dob_str,
            "_dob_check": dob_check,
            "_expiry_raw": expiry_str,
            "_expiry_check": expiry_check,
            "_personal_raw": personal_number,
            "_personal_check": personal_check,
            "_composite_check": composite_check
        }

def _empty_mrz_result() -> dict:
    return {
        "layout_format": "UNKNOWN", "surname": "UNREADABLE", "given_names": "UNREADABLE",
        "document_number": "UNREADABLE", "nationality": "UNKNOWN", "date_of_birth": "UNKNOWN",
        "sex": "UNKNOWN", "expiry_date": "UNKNOWN", "issuing_country": "UNKNOWN",
        "personal_number": "UNKNOWN", "mrz_line1": "", "mrz_line2": "",
        "_doc_number_raw": "", "_doc_check": "?", "_dob_raw": "000000", "_dob_check": "?",
        "_expiry_raw": "000000", "_expiry_check": "?", "_personal_raw": "", "_personal_check": "?"
    }

