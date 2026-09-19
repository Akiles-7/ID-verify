# app/modules/national_id_validators.py
import re

# Verhoeff algorithm multiplication table
_VERHOEFF_D = [
    [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
]

# Verhoeff algorithm permutation table
_VERHOEFF_P = [
    [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
]

def is_valid_aadhaar_checksum(number: str) -> bool:
    """Validates a 12-digit Aadhaar number using the Verhoeff checksum algorithm (the same algorithm UIDAI uses)."""
    if not number:
        return False
    digits = re.sub(r'\D', '', str(number))
    if len(digits) != 12:
        return False
    c = 0
    for i, digit in enumerate(reversed(digits)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(digit)]]
    return c == 0

DOC_TYPE_FAILURE_CHECKS = {
    "PASSPORT_TD3": [
        ("CHECKSUM", "Document number checksum (ICAO 7-3-1)"),
        ("CHECKSUM", "Date of birth checksum (ICAO 7-3-1)"),
        ("CHECKSUM", "Expiry date checksum (ICAO 7-3-1)"),
        ("CHECKSUM", "Composite MRZ checksum"),
        ("FORMAT", "MRZ character set compliance"),
    ],
    "DRIVER_LICENSE": [
        ("FORMAT", "License number format"),
        ("DATE_LOGIC", "Issue date precedes expiry date"),
        ("FORMAT", "Sex field valid (M/F)"),
        ("FORMAT", "Name fields alphabetic"),
    ],
    "AADHAAR": [
        ("CHECKSUM", "Aadhaar number checksum (Verhoeff algorithm)"),
        ("FORMAT", "Aadhaar number format (12 digits)"),
        ("FORMAT", "Enrollment number present"),
    ],
    "NATIONAL_ID": [
        ("FORMAT", "ID number format"),
        ("FORMAT", "Name fields alphabetic"),
    ],
}

def build_ocr_failure_checks(document_type: str) -> list:
    """Returns a document-type-appropriate set of failed checks instead of always defaulting to ICAO MRZ wording."""
    checks = [{
        "check_group": "OCR",
        "check_name": "Document data extraction",
        "passed": False,
        "computed_value": "0 fields",
        "stored_value": ">=3 key fields",
        "detail": "OCR could not extract legible identity fields from this image. Re-scan with better lighting, higher resolution, and the document flat against a dark background."
    }]
    relevant = DOC_TYPE_FAILURE_CHECKS.get(document_type, DOC_TYPE_FAILURE_CHECKS["NATIONAL_ID"])
    for group, name in relevant:
        checks.append({
            "check_group": group,
            "check_name": name,
            "passed": False,
            "computed_value": "N/A",
            "stored_value": "N/A",
            "detail": "Cannot validate — source field unreadable"
        })
    return checks
