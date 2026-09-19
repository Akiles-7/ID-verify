# test_extraction_pipeline.py
import sys
import os
import cv2
import numpy as np

# Test imports
from app.preprocessing.multi_doc_detector import decode_image_or_pdf, evaluate_image_quality, detect_multiple_documents
from app.modules.doc_classifier import classify_document
from app.modules.field_extractors import extract_document_fields, decode_barcodes_and_qr, disambiguate_numeric, disambiguate_alpha, normalize_date
from app.modules.cross_validator import perform_cross_validation
from app.modules.mrz_parser import parse_mrz_text
from app.modules.national_id_validators import is_valid_aadhaar_checksum
from app.modules.ocr_and_validation import extract_ocr_fields, validate_document, mask_sensitive_data

print("All module imports succeeded!")

# Test 1: Aadhaar Verhoeff algorithm
# Valid Aadhaar example (Verhoeff check passes for valid UIDAI numbers)
# Let's verify Verhoeff check function runs
print("Verhoeff check runs:", is_valid_aadhaar_checksum("367598346012"))

# Test 2: Sensitive Data Masking
test_log = "Processing passport A1234567, aadhaar 9876 5432 1098, PAN ABCDE1234F"
masked = mask_sensitive_data(test_log)
print("Masked log:", masked)
assert "9876 5432 1098" not in masked
assert "XXXX-XXXX-1098" in masked
assert "A****567" in masked

# Test 3: Document Classification
doc1 = classify_document("REPUBLIC OF INDIA PASSPORT TYPE P IND DOE JOHN")
print("Classified doc1:", doc1["document_type"], "confidence:", doc1["confidence"])
assert doc1["document_type"] == "Passport"

doc2 = classify_document("GOVERNMENT OF INDIA UNIQUE IDENTIFICATION AUTHORITY OF INDIA ENROLMENT MERA AADHAAR 9876 5432 1098")
print("Classified doc2:", doc2["document_type"], "confidence:", doc2["confidence"])
assert doc2["document_type"] == "Aadhaar"

doc3 = classify_document("INCOME TAX DEPARTMENT GOVT. OF INDIA PERMANENT ACCOUNT NUMBER ABCDE1234F")
print("Classified doc3:", doc3["document_type"], "confidence:", doc3["confidence"])
assert doc3["document_type"] == "PAN"

doc4 = classify_document("UNION OF INDIA DRIVING LICENCE DL NO DL0420110012345 TRANSPORT")
print("Classified doc4:", doc4["document_type"], "confidence:", doc4["confidence"])
assert doc4["document_type"] == "Driving Licence"

doc5 = classify_document("ELECTION COMMISSION OF INDIA ELECTOR PHOTO IDENTITY CARD EPIC NO ABC1234567")
print("Classified doc5:", doc5["document_type"], "confidence:", doc5["confidence"])
assert doc5["document_type"] == "Voter ID"

# Test 4: MRZ Checksums and Cross-Validation
mrz_line1 = "P<INDDOE<<ASWIN<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
mrz_line2 = "A1234567<8IND9001011M3001019<<<<<<<<<<<<<<02"
mrz_result = parse_mrz_text([mrz_line1, mrz_line2])
print("MRZ parsing result valid:", mrz_result.get("valid"), "type:", mrz_result.get("mrz_type"))

# Cross validation test
fields = {
    "passport_number": {"value": "A1234567", "raw_value": "A1234567"},
    "date_of_birth": {"value": "1990-01-01", "raw_value": "900101"},
    "date_of_expiry": {"value": "2030-01-01", "raw_value": "300101"},
    "nationality": {"value": "India", "raw_value": "IND"},
    "surname": {"value": "DOE"}
}
cross_res = perform_cross_validation(fields, mrz_result)
print("Cross validation status:", cross_res["status"], "passed checks:", cross_res["passed_checks"])
assert cross_res["has_mismatch"] == False
assert cross_res["passed_checks"] >= 3

# Test 5: Image quality evaluation on synthetic image
blank_img = np.ones((600, 800, 3), dtype=np.uint8) * 180
cv2.putText(blank_img, "PASSPORT OF INDIA", (50, 80), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)
quality = evaluate_image_quality(blank_img)
print("Image quality score:", quality["quality_score"], "sharpness:", quality["sharpness"])

# Test 6: Multi-document detection on test image
multi_docs = detect_multiple_documents(blank_img)
print("Detected documents count:", len(multi_docs))

print("ALL TESTS PASSED SUCCESSFULLY!")
