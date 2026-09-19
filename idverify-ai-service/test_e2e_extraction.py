# test_e2e_extraction.py
import cv2
import numpy as np
import json
from app.modules.ocr_and_validation import extract_ocr_fields, validate_document

print("=== Running End-to-End Extraction Verification ===")

# Create a test synthetic Passport image
h, w = 600, 850
img = np.ones((h, w, 3), dtype=np.uint8) * 240

# Add visual text
cv2.putText(img, "PASSPORT", (300, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 100), 2)
cv2.putText(img, "REPUBLIC OF INDIA", (260, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
cv2.putText(img, "Type: P  Country Code: IND  Passport No: Z1234567", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
cv2.putText(img, "Surname: SHARMA", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
cv2.putText(img, "Given Names: ROHIT", (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
cv2.putText(img, "Nationality: INDIAN", (50, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
cv2.putText(img, "Sex: M  Date of Birth: 15/05/1988", (50, 320), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
cv2.putText(img, "Date of Issue: 10/01/2020  Date of Expiry: 09/01/2030", (50, 360), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

# Add MRZ Zone at bottom
cv2.putText(img, "P<INDSHARMA<<ROHIT<<<<<<<<<<<<<<<<<<<<<<<<<<", (30, 510), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2)
cv2.putText(img, "Z1234567<4IND8805156M3001095<<<<<<<<<<<<<<06", (30, 550), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2)

_, img_bytes = cv2.imencode(".jpg", img)

logs = []
res = extract_ocr_fields(img_bytes.tobytes(), "PASSPORT", logs)

print(f"Extraction Success: {res.get('success')}")
print(f"Document Type: {res.get('document_type')}")
print(f"OCR Confidence: {res.get('ocr_confidence')}")
print(f"MRZ Valid: {res.get('mrz_result', {}).get('valid')}")

structured = res.get("structured_fields", {})
print("\nStructured Fields:")
for k, v in structured.items():
    if isinstance(v, dict):
        val = v.get("value")
        conf = v.get("confidence")
        status = v.get("status")
        src = v.get("source")
        if val is not None:
            print(f" - {k}: {val} (conf: {int(conf*100)}%, status: {status}, source: {src})")

val_res = validate_document(res, logs)
print(f"\nDocument Validation Result: {val_res.get('valid')}")
for c in val_res.get("checks", []):
    print(f" - [{c.get('check_group')}] {c.get('check_name')}: {'PASS' if c.get('passed') else 'FAIL'}")

assert res.get("document_type") == "Passport"
print("\n=== E2E Extraction Verification Completed Successfully! ===")
