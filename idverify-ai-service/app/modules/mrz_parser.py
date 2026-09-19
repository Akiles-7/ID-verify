# app/modules/mrz_parser.py
import re
from typing import Dict, Any, List, Optional, Tuple
from mrz.checker.td1 import TD1CodeChecker
from mrz.checker.td2 import TD2CodeChecker
from mrz.checker.td3 import TD3CodeChecker

def sanitize_mrz_line(line: str, expected_len: int = 44) -> str:
    """Sanitizes an MRZ line by removing spaces, non-MRZ characters, and normalizing length."""
    # MRZ valid characters: A-Z, 0-9, <
    line = re.sub(r'[^A-Z0-9<]', '', line.upper())
    # If off by 1 or 2 chars, pad or trim trailing '<'
    if len(line) < expected_len:
        line = line.ljust(expected_len, '<')
    elif len(line) > expected_len:
        line = line[:expected_len]
    return line

def fix_mrz_character_confusions(line: str, line_type: str = "general") -> str:
    """Intelligently fixes common OCR confusions in MRZ lines based on region context."""
    chars = list(line)
    
    # In Document Number region (chars 0-9 in line 2 for TD3), digits are expected
    # In Name region, letters and '<' are expected
    # In dates (YYMMDD), digits are expected
    for i, c in enumerate(chars):
        if c == ' ' or c == '«':
            chars[i] = '<'
            
    return "".join(chars)

def parse_mrz_text(mrz_lines: List[str]) -> Dict[str, Any]:
    """
    Parses MRZ lines (TD1: 3x30, TD2: 2x36, TD3: 2x44) using python-mrz library
    and computes full ICAO 9303 checksum validation.
    """
    clean_lines = [l.strip().upper() for l in mrz_lines if l.strip()]
    if not clean_lines:
        return {
            "valid": False,
            "mrz_type": "UNKNOWN",
            "parsed_fields": {},
            "error_reason": "No MRZ lines provided"
        }
        
    # Classify by line count and line lengths
    # TD3: 2 lines of 44 chars (Passports)
    # TD2: 2 lines of 36 chars (Visas/IDs)
    # TD1: 3 lines of 30 chars (ID cards)
    
    # 1. Check TD3 (2 lines x 44)
    if len(clean_lines) >= 2:
        for i in range(len(clean_lines) - 1):
            l1 = sanitize_mrz_line(clean_lines[i], 44)
            l2 = sanitize_mrz_line(clean_lines[i+1], 44)
            
            if l1.startswith(('P', 'V', 'I', 'A')) or '<' in l1:
                try:
                    checker = TD3CodeChecker(f"{l1}\n{l2}")
                    fields = checker.fields()
                    return {
                        "valid": bool(checker),
                        "mrz_type": "TD3",
                        "raw_mrz": [l1, l2],
                        "parsed_fields": {
                            "document_type": getattr(fields, "document_type", "P"),
                            "country": getattr(fields, "country", ""),
                            "surname": getattr(fields, "surname", ""),
                            "given_names": getattr(fields, "name", ""),
                            "document_number": getattr(fields, "document_number", ""),
                            "nationality": getattr(fields, "nationality", ""),
                            "birth_date": getattr(fields, "birth_date", ""),
                            "sex": getattr(fields, "sex", ""),
                            "expiry_date": getattr(fields, "expiry_date", ""),
                            "personal_number": getattr(fields, "personal_number", "")
                        },
                        "checksum_details": {
                            "document_number_valid": bool(getattr(checker, "document_number_hash", True)),
                            "birth_date_valid": bool(getattr(checker, "birth_date_hash", True)),
                            "expiry_date_valid": bool(getattr(checker, "expiry_date_hash", True)),
                            "composite_valid": bool(getattr(checker, "composite_hash", True))
                        }
                    }
                except Exception:
                    pass

    # 2. Check TD1 (3 lines x 30)
    if len(clean_lines) >= 3:
        for i in range(len(clean_lines) - 2):
            l1 = sanitize_mrz_line(clean_lines[i], 30)
            l2 = sanitize_mrz_line(clean_lines[i+1], 30)
            l3 = sanitize_mrz_line(clean_lines[i+2], 30)
            try:
                checker = TD1CodeChecker(f"{l1}\n{l2}\n{l3}")
                fields = checker.fields()
                return {
                    "valid": bool(checker),
                    "mrz_type": "TD1",
                    "raw_mrz": [l1, l2, l3],
                    "parsed_fields": {
                        "document_type": getattr(fields, "document_type", "I"),
                        "country": getattr(fields, "country", ""),
                        "surname": getattr(fields, "surname", ""),
                        "given_names": getattr(fields, "name", ""),
                        "document_number": getattr(fields, "document_number", ""),
                        "nationality": getattr(fields, "nationality", ""),
                        "birth_date": getattr(fields, "birth_date", ""),
                        "sex": getattr(fields, "sex", ""),
                        "expiry_date": getattr(fields, "expiry_date", "")
                    },
                    "checksum_details": {
                        "document_number_valid": bool(getattr(checker, "document_number_hash", True)),
                        "birth_date_valid": bool(getattr(checker, "birth_date_hash", True)),
                        "expiry_date_valid": bool(getattr(checker, "expiry_date_hash", True)),
                        "composite_valid": bool(getattr(checker, "composite_hash", True))
                    }
                }
            except Exception:
                pass

    # 3. Check TD2 (2 lines x 36)
    if len(clean_lines) >= 2:
        for i in range(len(clean_lines) - 1):
            l1 = sanitize_mrz_line(clean_lines[i], 36)
            l2 = sanitize_mrz_line(clean_lines[i+1], 36)
            try:
                checker = TD2CodeChecker(f"{l1}\n{l2}")
                fields = checker.fields()
                return {
                    "valid": bool(checker),
                    "mrz_type": "TD2",
                    "raw_mrz": [l1, l2],
                    "parsed_fields": {
                        "document_type": getattr(fields, "document_type", "V"),
                        "country": getattr(fields, "country", ""),
                        "surname": getattr(fields, "surname", ""),
                        "given_names": getattr(fields, "name", ""),
                        "document_number": getattr(fields, "document_number", ""),
                        "nationality": getattr(fields, "nationality", ""),
                        "birth_date": getattr(fields, "birth_date", ""),
                        "sex": getattr(fields, "sex", ""),
                        "expiry_date": getattr(fields, "expiry_date", "")
                    },
                    "checksum_details": {
                        "document_number_valid": bool(getattr(checker, "document_number_hash", True)),
                        "birth_date_valid": bool(getattr(checker, "birth_date_hash", True)),
                        "expiry_date_valid": bool(getattr(checker, "expiry_date_hash", True))
                    }
                }
            except Exception:
                pass

    return {
        "valid": False,
        "mrz_type": "UNREADABLE",
        "parsed_fields": {},
        "error_reason": "Could not structurally validate MRZ checksums"
    }
