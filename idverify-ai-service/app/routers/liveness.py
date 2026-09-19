# app/routers/liveness.py
from fastapi import APIRouter, UploadFile, File, Body
from typing import List
from app.modules.liveness import evaluate_real_liveness, evaluate_multi_frame_liveness

router = APIRouter()

@router.post("/liveness/frame")
async def liveness_frame(frame: UploadFile = File(...)):
    contents = await frame.read()
    return evaluate_real_liveness(contents)

@router.post("/liveness/sequence")
async def liveness_sequence(frames: List[UploadFile] = File(...), challenge_type: str = "ANY"):
    frames_bytes = [await f.read() for f in frames]
    return evaluate_multi_frame_liveness(frames_bytes, challenge_type=challenge_type)

@router.post("/liveness/score")
async def liveness_score(frame: UploadFile = File(...)):
    contents = await frame.read()
    return evaluate_real_liveness(contents)
