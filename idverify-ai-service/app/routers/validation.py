# app/routers/validation.py
from fastapi import APIRouter, Body
from app.modules.ocr_and_validation import validate_document

router = APIRouter()

@router.post("/validate")
async def validate(ocr_data: dict = Body(...)):
    return validate_document(ocr_data)
