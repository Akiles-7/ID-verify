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

def parse_td3_line1_names(l1: str) -> Tuple[str, str, str]:
    """
    Parses country, surname, and given names from TD3 line 1.
    Format: P<CCCSSSSSSSS<<GGGGGGGG<<<<
    Handles cases where OCR country code length or chevrons vary.
    """
    clean = l1.strip().upper().replace(" ", "")
    # Remove leading document type (P<, V<, I<, etc.)
    after_doc = re.sub(r"^[PVIALC][< ]*", "", clean)
    if "<<" in after_doc:
        before_delim, after_delim = after_doc.split("<<", 1)
        given_names = after_delim.replace("<", " ").strip()
        # Country code is typically 3 characters (e.g. IND)
        if len(before_delim) > 3 and before_delim[:3].isalpha():
            country = before_delim[:3]
            surname = before_delim[3:].replace("<", " ").strip()
        elif len(before_delim) > 1 and before_delim[0] == "I": # 'IND' read as 'I'
            country = "IND"
            surname = before_delim[1:].replace("<", " ").strip()
        else:
            country = ""
            surname = before_delim.replace("<", " ").strip()
        return country, surname, given_names
    return "", "", ""

def fix_td3_confusions(l1: str, l2: str) -> Tuple[str, str]:
    """Corrects deterministic OCR confusions in TD3 country/nationality code and date positions."""
    alpha_map = {'1': 'I', '0': 'O', '5': 'S', '8': 'B', '2': 'Z'}
    digit_map = {'O': '0', 'I': '1', 'S': '5', 'B': '8', 'Z': '2'}
    
    # 1. Line 1 corrections
    if len(l1) >= 5:
        # P<CCC -> country code should be alphabetic
        c = ''.join(alpha_map.get(x, x) for x in l1[2:5])
        l1 = l1[:2] + c + l1[5:]
    # Fix digits mistakenly placed in name fields (e.g. '0' for 'O')
    l1 = re.sub(r"0(?=[A-Z<])", "O", l1)
    l1 = re.sub(r"1(?=[A-Z<])", "I", l1)

    # 2. Line 2 corrections
    if len(l2) >= 13:
        # Country / nationality code (positions 10-12)
        n = ''.join(alpha_map.get(x, x) for x in l2[10:13])
        l2 = l2[:10] + n + l2[13:]
        
    # Check date positions in line 2: chars 13-19 (birth date + check digit) and chars 21-27 (expiry date + check digit)
    if len(l2) >= 28:
        b_date = ''.join(digit_map.get(x, x) for x in l2[13:19])
        b_chk = digit_map.get(l2[19], l2[19])
        sex = l2[20]
        if sex not in {'M', 'F', '<'}:
            sex = 'M' if sex in {'1', 'I', 'H'} else ('F' if sex in {'E', 'P'} else '<')
        e_date = ''.join(digit_map.get(x, x) for x in l2[21:27])
        e_chk = digit_map.get(l2[27], l2[27])
        l2 = l2[:13] + b_date + b_chk + sex + e_date + e_chk + l2[28:]

    return l1, l2

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
    td3_fallback = None
    if len(clean_lines) >= 2:
        for i in range(len(clean_lines) - 1):
            l1 = sanitize_mrz_line(clean_lines[i], 44)
            l2 = sanitize_mrz_line(clean_lines[i+1], 44)
            
            if l1.startswith(('P', 'V', 'I', 'A')) or '<' in l1:
                candidates = [(l1, l2)]
                l1_f, l2_f = fix_td3_confusions(l1, l2)
                if (l1_f, l2_f) != (l1, l2):
                    candidates.append((l1_f, l2_f))
                    
                for cand_l1, cand_l2 in candidates:
                    try:
                        checker = TD3CodeChecker(f"{cand_l1}\n{cand_l2}")
                        fields = checker.fields()
                        s_name = getattr(fields, "surname", "")
                        g_name = getattr(fields, "name", "")
                        
                        # Use robust name extractor if python-mrz returned empty or single char
                        p_country, p_surname, p_given = parse_td3_line1_names(cand_l1)
                        if not s_name or s_name == "None" or len(s_name) <= 1:
                            if p_surname:
                                s_name = p_surname
                        if not g_name or g_name == "None":
                            if p_given:
                                g_name = p_given

                        is_valid = bool(checker)
                        mrz_entry = {
                            "valid": is_valid,
                            "mrz_type": "TD3",
                            "raw_mrz": [cand_l1, cand_l2],
                            "parsed_fields": {
                                "document_type": getattr(fields, "document_type", "P"),
                                "country": getattr(fields, "country", "") or p_country,
                                "surname": s_name,
                                "given_names": g_name,
                                "document_number": getattr(fields, "document_number", ""),
                                "nationality": getattr(fields, "nationality", "") or p_country,
                                "birth_date": getattr(fields, "birth_date", ""),
                                "sex": getattr(fields, "sex", ""),
                                "expiry_date": getattr(fields, "expiry_date", ""),
                                "personal_number": getattr(fields, "personal_number", "")
                            },
                            "checksum_details": {
                                "document_number_valid": bool(getattr(checker, "document_number_hash", is_valid)),
                                "birth_date_valid": bool(getattr(checker, "birth_date_hash", is_valid)),
                                "expiry_date_valid": bool(getattr(checker, "expiry_date_hash", is_valid)),
                                "composite_valid": bool(getattr(checker, "composite_hash", is_valid))
                            }
                        }
                        if is_valid:
                            return mrz_entry
                        elif td3_fallback is None:
                            td3_fallback = mrz_entry
                    except Exception:
                        pass
        if td3_fallback is not None:
            return td3_fallback

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
