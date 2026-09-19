import unittest
import cv2
import numpy as np
import sys
sys.path.insert(0, ".")

from app.preprocessing.preprocessing import analyze_image_quality, build_preprocessing_variants
from app.modules.mrz_parser import parse_mrz_text
from app.modules.ocr_and_validation import _extract_passport_page_fields, _passport_fallback_fields
from app.modules.liveness import evaluate_real_liveness, evaluate_multi_frame_liveness
from app.modules.tampering_and_face import analyze_tampering, verify_face, compute_risk_score

class TestAIServiceModules(unittest.TestCase):

    def setUp(self):
        # Create synthetic document & face images for testing
        self.img = np.zeros((400, 600, 3), dtype=np.uint8)
        cv2.rectangle(self.img, (50, 50), (550, 350), (255, 255, 255), -1)
        cv2.putText(self.img, "PASSPORT USA", (100, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 0), 2)
        _, buf = cv2.imencode('.jpg', self.img)
        self.img_bytes = buf.tobytes()

    def test_preprocessing(self):
        quality = analyze_image_quality(self.img)
        self.assertIsNotNone(quality)
        self.assertIn("blur_level", quality)
        
        variants = build_preprocessing_variants(self.img, quality)
        self.assertIsNotNone(variants)
        self.assertIn("variant_a", variants)

    def test_mrz_parser_valid_td3(self):
        mrz_lines = [
            "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
            "L898902C36UTO6908061F2801016ZE184226B<<<<<14"
        ]
        res = parse_mrz_text(mrz_lines)
        self.assertTrue(res.get("valid"))
        self.assertEqual(res.get("mrz_type"), "TD3")
        self.assertEqual(res.get("parsed_fields", {}).get("surname"), "ERIKSSON")

    def test_mrz_parser_invalid_checksum(self):
        mrz_lines = [
            "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
            "L898902C39UTO6908061F2801016ZE184226B<<<<<14"
        ]
        res = parse_mrz_text(mrz_lines)
        self.assertFalse(res.get("valid"))

    def test_passport_fallback_recovers_noisy_mrz_fields(self):
        text = "O N GREPUSLCOA SP003369 THAPLIYAL G GARIMA 01/07/1994 F DELHI DELHI COIMBATORE 03/09/2024 02/09/2034"
        mrz_lines = [
            "P<INDTAPIYAL<<GARIM<<<<<<<<<<<<<<<<<<<<<<<<<",
            "SP003369<21ND9407015F34090281065269546124<78",
        ]
        fields = _passport_fallback_fields(text, mrz_lines, "PASSPORT", 0.98)
        values = {key: value["value"] for key, value in fields.items() if isinstance(value, dict)}
        self.assertEqual(values["document_number"], "SP003369")
        self.assertEqual(values["surname"], "THAPLIYAL")
        self.assertEqual(values["given_names"], "GARIMA")
        self.assertEqual(values["nationality"], "IND")
        self.assertEqual(values["date_of_birth"], "1994-07-01")
        self.assertEqual(values["sex"], "F")
        self.assertEqual(values["expiry_date"], "2034-09-02")
        self.assertEqual(values["issuing_country"], "IND")
        self.assertEqual(values["personal_number"], "1065269546124")

    def test_passport_page_fields_match_document_layout(self):
        text = "Passport No. Code Nationality Type INDIAN IND P AM846251 /Surname MURUGAN /Given Name(s) SABARINATHAN /Sex M /Date of Birth 13/10/2006 /Place of Birth DHARMAPURI, TAMIL NADU /Place of Issue CHENNAI /Date of Issue 30/01/2026 /Date of Expiry 29/01/2036"
        fields = _passport_fallback_fields(
            text,
            ["P<INDMURUGAN<<SABARINATHAN<<<<<<<<<<<<<<<<<<", "AM846251<01IND0610135M3601291D066255996726<84"],
            "PASSPORT",
            0.98,
        )
        values = {key: value["value"] for key, value in fields.items() if isinstance(value, dict)}
        self.assertEqual(values["document_type"], "P")
        self.assertEqual(values["country_code"], "IND")
        self.assertEqual(values["nationality"], "INDIAN")
        self.assertEqual(values["document_number"], "AM846251")
        self.assertEqual(values["surname"], "MURUGAN")
        self.assertEqual(values["given_names"], "SABARINATHAN")
        self.assertEqual(values["date_of_birth"], "2006-10-13")
        self.assertEqual(values["sex"], "M")
        self.assertEqual(values["place_of_birth"], "DHARMAPURI, TAMIL NADU")
        self.assertEqual(values["place_of_issue"], "CHENNAI")
        self.assertEqual(values["date_of_issue"], "2026-01-30")
        self.assertEqual(values["expiry_date"], "2036-01-29")

    def test_passport_mrz_name_overrides_spurious_page_ocr_token(self):
        text = "Passport No. W7786074 Type P Code IND Nationality INDIAN Surname THONEES Given Name(s) JEROJA PARR Sex F Date of Birth 16/06/1987 Place of Birth POONTHURA KERALA Date of Issue 09/01/2023 Date of Expiry 08/01/2033"
        fields = _passport_fallback_fields(
            text,
            ["P<INDTHONEES<<JEROJA<<<<<<<<<<<<<<<<<<<<<<<", "W7786074<7IND8706168F33010852064859833922<18"],
            "PASSPORT",
            0.98,
        )
        values = {key: value["value"] for key, value in fields.items() if isinstance(value, dict)}
        self.assertEqual(values["surname"], "THONEES")
        self.assertEqual(values["given_names"], "JEROJA")

    def test_passport_dates_recover_when_ocr_merges_validity_labels(self):
        text = "Passport No. W7786074 Type P Code IND Nationality INDIAN Surname THONEES Given Name(s) JEROJA Sex F Date of Birth 16/06/1987 Date of Expiry STVE Date of Issue 08/01/2033 09/01/2023"
        fields = _passport_fallback_fields(
            text,
            ["P<INDTHONEES<<JEROJA<<<<<<<<<<<<<<<<<<<<<<<", "W7786074<7IND8706168F33010852064859833922<18"],
            "PASSPORT",
            0.98,
        )
        values = {key: value["value"] for key, value in fields.items() if isinstance(value, dict)}
        self.assertEqual(values["date_of_issue"], "2023-01-09")
        self.assertEqual(values["expiry_date"], "2033-01-08")

    def test_liveness_no_face(self):
        blank = np.zeros((200, 200, 3), dtype=np.uint8)
        _, buf = cv2.imencode('.jpg', blank)
        res = evaluate_real_liveness(buf.tobytes())
        self.assertFalse(res.get("liveness_passed"))
        self.assertEqual(res.get("liveness_status"), "NO_FACE")

    def test_forensic_tampering(self):
        res = analyze_tampering(self.img_bytes)
        self.assertIn("overall_tamper_score", res)

    def test_risk_scoring(self):
        ocr = {"ocr_engine": "PaddleOCR"}
        val = {"valid": True, "passed_count": 5, "total_count": 5}
        tamp = {"overall_tamper_score": 10.0}
        face = {"matched": True, "status": "VERIFIED"}
        live = {"liveness_passed": True}
        
        res = compute_risk_score(ocr, val, tamp, face, live)
        self.assertEqual(res.get("risk_level"), "LOW")

if __name__ == "__main__":
    unittest.main()
