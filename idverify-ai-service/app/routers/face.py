# app/routers/face.py
from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional
from app.modules.tampering_and_face import verify_face

router = APIRouter()

@router.post("/face/verify")
async def face_verify(
    doc_image: UploadFile = File(None),
    live_image: UploadFile = File(None),
    doc_face_b64: Optional[str] = Form(None),
    live_face_b64: Optional[str] = Form(None),
    model: str = Form("ArcFace"),
    threshold: float = Form(0.68)
):
    d_bytes = await doc_image.read() if doc_image else (doc_face_b64.encode() if doc_face_b64 else b"")
    l_bytes = await live_image.read() if live_image else (live_face_b64.encode() if live_face_b64 else b"")
    logs = []
    return verify_face(d_bytes, l_bytes, logs=logs, threshold=threshold)


