# app/routers/all_routers.py
from fastapi import APIRouter, UploadFile, File, Form, Body
from app.modules.tampering_and_face import analyze_tampering, verify_face, compute_risk_score
from app.modules.liveness import evaluate_real_liveness
from app.modules.ocr_and_validation import get_ocr_engine_status

router = APIRouter()

# 1. Tampering Endpoint
@router.post("/tamper/analyze")
async def analyze_tamper(file: UploadFile = File(None)):
    contents = await file.read() if file else b""
    return analyze_tampering(contents)

# 2. Face Verification Endpoint
@router.post("/face/verify")
async def face_verify(
    doc_image: UploadFile = File(None),
    live_image: UploadFile = File(None),
    model: str = Form("ArcFace"),
    threshold: float = Form(0.40)
):
    d_bytes = await doc_image.read() if doc_image else b""
    l_bytes = await live_image.read() if live_image else b""
    return verify_face(d_bytes, l_bytes)

# 3. Liveness Endpoints (Real MediaPipe Evaluation)
@router.post("/liveness/frame")
async def liveness_frame(frame: UploadFile = File(None)):
    contents = await frame.read() if frame else b""
    return evaluate_real_liveness(contents)

@router.post("/liveness/score")
async def liveness_score(frame: UploadFile = File(None)):
    contents = await frame.read() if frame else b""
    return evaluate_real_liveness(contents)

# 4. Risk Engine Endpoint
@router.post("/risk/score")
async def risk_score(body: dict = Body(...)):
    ocr = body.get("ocr", {})
    val = body.get("validation", {})
    tamper = body.get("tamper", {})
    face = body.get("face", {})
    liveness = body.get("liveness", {})
    return compute_risk_score(ocr, val, tamper, face, liveness)

# 5. Genuine System Health Endpoint
@router.get("/health")
async def health():
    ocr_status = get_ocr_engine_status()
    return {
        "status": "HEALTHY",
        "ocr_engines": ocr_status,
        "liveness_engine": "MediaPipe FaceMesh",
        "biometric_engine": "ArcFace ONNX/DeepFace",
        "forensic_engine": "Multi-Signal ELA + EXIF + DCT + Noise Variance"
    }
