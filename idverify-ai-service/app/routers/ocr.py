# app/routers/ocr.py
from fastapi import APIRouter, UploadFile, File, Form
from app.modules.ocr_and_validation import extract_ocr_fields

router = APIRouter()

@router.post("/ocr/extract")
async def extract_ocr(documentType: str = Form("PASSPORT"), file: UploadFile = File(None)):
    contents = await file.read() if file else b""
    return extract_ocr_fields(contents, documentType)
