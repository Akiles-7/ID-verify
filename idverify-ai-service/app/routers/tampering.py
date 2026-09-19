# app/routers/tampering.py
from fastapi import APIRouter, UploadFile, File
from app.modules.tampering_and_face import analyze_tampering

router = APIRouter()

@router.post("/tamper/analyze")
async def analyze_tamper(file: UploadFile = File(None)):
    contents = await file.read() if file else b""
    return analyze_tampering(contents)
