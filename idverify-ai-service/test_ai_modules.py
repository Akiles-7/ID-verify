import unittest
import cv2
import numpy as np
import sys
sys.path.insert(0, ".")

from app.preprocessing.preprocessing import analyze_image_quality, build_preprocessing_variants
from app.modules.mrz_parser import parse_mrz_text
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
