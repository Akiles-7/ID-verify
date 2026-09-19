# app/routers/risk.py
from fastapi import APIRouter, Body
from app.modules.tampering_and_face import compute_risk_score

router = APIRouter()

@router.post("/risk/score")
async def risk_score(body: dict = Body(...)):
    ocr = body.get("ocr", {})
    val = body.get("validation", {})
    tamper = body.get("tamper", {})
    face = body.get("face", {})
    weights = body.get("weights", None)
    return compute_risk_score(ocr, val, tamper, face, weights)
