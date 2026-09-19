# app/modules/doc_classifier.py
import re
from typing import Dict, Any, List, Optional, Tuple

def classify_document(raw_text: str, mrz_lines: List[str] = None, barcodes: List[str] = None) -> Dict[str, Any]:
    """
    Automatically determine the type of document uploaded using text keywords,
    MRZ headers, regex patterns, and structural cues.
    
    Possible classifications:
    - Passport
    - Aadhaar
    - PAN
    - Driving Licence
    - Voter ID
    - National ID
    - Residence permit
    - Other government ID
    - Unknown document
    """
    if mrz_lines is None:
        mrz_lines = []
    if barcodes is None:
        barcodes = []
        
    text = (raw_text or "").upper()
    scores: Dict[str, float] = {
        "Passport": 0.0,
        "Aadhaar": 0.0,
        "PAN": 0.0,
        "Driving Licence": 0.0,
        "Voter ID": 0.0,
        "National ID": 0.0,
        "Residence permit": 0.0,
        "Other government ID": 0.0,
    }
    
    # 1. MRZ Signature Check
    for line in mrz_lines:
        clean = line.strip().upper().replace(" ", "")
        if clean.startswith("P<") or clean.startswith("P/"):
            scores["Passport"] += 0.95
        elif clean.startswith("I<") or clean.startswith("A<"):
            scores["National ID"] += 0.70
        elif clean.startswith("V<"):
            scores["Passport"] += 0.50
        elif clean.startswith("C<"):
            scores["Residence permit"] += 0.85

    # 2. Passport Indicators
    if re.search(r"\bPASSPORT\b", text):
        scores["Passport"] += 0.60
    if re.search(r"\bREPUBLIC OF INDIA\b", text):
        scores["Passport"] += 0.70
    if re.search(r"\b[A-Z]\d{7}\b", text):
        scores["Passport"] += 0.40
    if re.search(r"\bTYPE\s*[:/-]?\s*P\b", text):
        scores["Passport"] += 0.35
    if re.search(r"\bSURNAME\b", text) and re.search(r"\bGIVEN\s*NAME", text) and ("NATIONALITY" in text):
        scores["Passport"] += 0.50

    # 3. Aadhaar Indicators
    if re.search(r"\b(AADHAAR|AADHAR|UIDAI)\b", text):
        scores["Aadhaar"] += 0.75
    if re.search(r"\bUNIQUE IDENTIFICATION AUTHORITY OF INDIA\b", text):
        scores["Aadhaar"] += 0.90
    if re.search(r"\bGOVERNMENT OF INDIA\b", text) and ("MERA AADHAAR" in text or "ENROLMENT" in text or "VID" in text):
        scores["Aadhaar"] += 0.70
    if re.search(r"\b\d{4}\s\d{4}\s\d{4}\b", text):
        scores["Aadhaar"] += 0.55
    if re.search(r"\bMERA AADHAAR MERI PEHCHAN\b", text):
        scores["Aadhaar"] += 0.85

    # 4. PAN Indicators
    if re.search(r"\bINCOME\s*TAX\s*DEPARTMENT\b", text):
        scores["PAN"] += 0.85
    if re.search(r"\bPERMANENT\s*ACCOUNT\s*NUMBER\b", text) or re.search(r"\bPAN\s*CARD\b", text):
        scores["PAN"] += 0.80
    if re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", text):
        scores["PAN"] += 0.65
    if re.search(r"\bFATHER'?S\s*NAME\b", text) and re.search(r"\bGOVT\.?\s*OF\s*INDIA\b", text):
        scores["PAN"] += 0.30

    # 5. Driving Licence Indicators
    if re.search(r"\b(DRIVING\s*LICEN[CS]E|DRIVER\s*LICEN[CS]E)\b", text):
        scores["Driving Licence"] += 0.95
    if re.search(r"\b(INDIAN\s*UNION|UNION\s*OF\s*INDIA)\b", text):
        scores["Driving Licence"] += 0.85
    if re.search(r"\bMOTOR\s*VEHICLES?\s*ACT\b", text) or re.search(r"\bTRANSPORT\s*DEPARTMENT\b", text):
        scores["Driving Licence"] += 0.75
    if re.search(r"\bDL\s*NO\b|\bLICEN[CS]E\s*NO\b", text):
        scores["Driving Licence"] += 0.50
    if re.search(r"\b[A-Z]{2}[- ]?[0-9]{2}[- ]?[0-9]{4}[- ]?[0-9]{7}\b", text) or re.search(r"\b[A-Z]{2}[0-9]{13,15}\b", text.replace("-", "").replace(" ", "")):
        scores["Driving Licence"] += 0.95

    # 6. Voter ID (EPIC) Indicators
    if re.search(r"\bELECTION\s*COMMISSION\s*OF\s*INDIA\b", text):
        scores["Voter ID"] += 0.90
    if re.search(r"\bELECTOR\s*PHOTO\s*IDENTITY\s*CARD\b", text) or re.search(r"\bEPIC\s*NO\b", text):
        scores["Voter ID"] += 0.85
    if re.search(r"\b[A-Z]{3}[0-9]{7}\b", text):
        scores["Voter ID"] += 0.55

    # 7. Residence Permit
    if re.search(r"\bRESIDENCE\s*PERMIT\b|\bPERMIT\s*DE\s*SEJOUR\b|\bAUFENTHALTSTITEL\b", text):
        scores["Residence permit"] += 0.85

    # 8. National ID / Other government ID
    if re.search(r"\bNATIONAL\s*ID(ENTITY)?\s*(CARD)?\b", text) or re.search(r"\bIDENTITY\s*CARD\b", text):
        scores["National ID"] += 0.60
    if re.search(r"\bGOVERNMENT\s*OF\b", text) and not any(scores[k] > 0.4 for k in ["Aadhaar", "PAN", "Voter ID", "Passport"]):
        scores["Other government ID"] += 0.45

    # Find the maximum scoring classification
    best_type, best_score = max(scores.items(), key=lambda item: item[1])

    # Calibrate confidence
    confidence = min(0.99, best_score)
    
    # If confidence is below threshold (< 0.40) or no meaningful keywords found
    if confidence < 0.40:
        return {
            "document_type": "Unknown document",
            "confidence": round(max(0.15, confidence), 2),
            "is_confident": False,
            "raw_scores": scores
        }
        
    is_confident = confidence >= 0.70
    return {
        "document_type": best_type,
        "confidence": round(confidence, 2),
        "is_confident": is_confident,
        "raw_scores": scores
    }
