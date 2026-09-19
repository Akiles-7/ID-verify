from fastapi import APIRouter
from app.modules.ocr_and_validation import get_ocr_engine_status

router = APIRouter()

@router.get("/health")
async def health():
    ocr_status = get_ocr_engine_status()

    try:
        from app.modules.face_utils import get_dnn_face_detector
        face_detector_ready = get_dnn_face_detector() is not None
    except Exception:
        face_detector_ready = False

    try:
        from app.modules.tampering_and_face import _deepface_available
        face_verifier_ready = bool(_deepface_available)
    except Exception:
        face_verifier_ready = False

    try:
        from app.modules.liveness import _mediapipe_available
        liveness_ready = bool(_mediapipe_available)
    except Exception:
        liveness_ready = False

    components = {
        "ocr": ocr_status.get("status") == "READY",
        "face_detector": face_detector_ready,
        "face_verifier": face_verifier_ready,
        "liveness": liveness_ready,
    }
    overall = "HEALTHY" if all(components.values()) else "DEGRADED"

    return {
        "status": overall,
        "ocr_engines": ocr_status,
        "models": {
            "primary_ocr": ocr_status.get("primary_ocr_engine", "NONE"),
            "mrz_parser": "python-mrz",
            "face_detector": "OpenCV SSD Caffe DNN" if face_detector_ready else "UNAVAILABLE",
            "face_verifier": "DeepFace ArcFace" if face_verifier_ready else "UNAVAILABLE",
            "liveness_tracker": "MediaPipe Face Mesh" if liveness_ready else "UNAVAILABLE",
            "tampering_forensics": "ELA + EXIF + DCT + Local Noise Variance",
        },
        "readiness": components,
        "device": "CPU",
        "model_readiness": "READY" if overall == "HEALTHY" else "PARTIAL",
    }
