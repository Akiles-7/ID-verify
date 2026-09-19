# app/routers/face.py
from fastapi import APIRouter, UploadFile, File, Form
from app.modules.tampering_and_face import verify_face

router = APIRouter()

@router.post("/face/verify")
async def face_verify(doc_image: UploadFile = File(None), live_image: UploadFile = File(None), model: str = Form("ArcFace"), threshold: float = Form(0.40)):
    d_bytes = await doc_image.read() if doc_image else b""
    l_bytes = await live_image.read() if live_image else b""
    return verify_face(d_bytes, l_bytes, model_name=model, threshold=threshold)

