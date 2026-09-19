# app/routers/pipeline.py
import asyncio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Optional

from app.modules.ocr_and_validation import extract_ocr_fields, validate_document
from app.modules.tampering_and_face import analyze_tampering, verify_face, compute_risk_score
from app.modules.liveness import evaluate_real_liveness

router = APIRouter()

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB cap
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "application/pdf"}

def validate_uploaded_file(file: UploadFile, label: str):
    """Validates file size and MIME type / magic bytes before processing."""
    if file and file.filename:
        # Check size if available
        if hasattr(file, "size") and file.size and file.size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{label} file size exceeds maximum permitted limit (15 MB)"
            )
        # Check MIME type & extension
        fname = file.filename.lower()
        ctype = (file.content_type or "").lower()
        if ctype not in ALLOWED_MIME_TYPES and not ctype.startswith("image/") and not fname.endswith((".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{label} invalid file format ({ctype}). Please upload a valid JPEG, PNG, WebP, or PDF document."
            )


@router.post("/pipeline")
@router.post("/pipeline/run")
async def pipeline_run(
    documentType: str = Form("PASSPORT"),
    file: UploadFile = File(None),
    document: UploadFile = File(None),
    livePhoto: UploadFile = File(None),
    faceModel: str = Form("ARCFACE"),
    faceThreshold: float = Form(0.68),
    elaQuality: int = Form(85),
    enableCanny: bool = Form(True),
    enableExif: bool = Form(True)
):
    doc_file = file or document
    """
    Parallelized 5-module forensic pipeline:
    Executes CPU-bound OCR, Forensic Tampering, Biometric Face Verification,
    and MediaPipe Liveness concurrently using asyncio.to_thread().
    """
    # 1. Input Validation
    validate_uploaded_file(doc_file, "Document")
    validate_uploaded_file(livePhoto, "Live Photo")
    
    f_bytes = await doc_file.read() if doc_file else b""
    l_bytes = await livePhoto.read() if livePhoto else b""

    if not f_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document image file is required"
        )

    logs = []

    # 2. Parallel Execution of Independent Tasks
    # Task A: OCR Extraction
    # Task B: Forensic Tampering Detection
    # Task C: Biometric Face Verification (if livePhoto provided)
    # Task D: Liveness Evaluation (if livePhoto provided)

    ocr_task = asyncio.to_thread(extract_ocr_fields, f_bytes, documentType, logs)
    tamper_task = asyncio.to_thread(analyze_tampering, f_bytes, logs)
    
    face_task = asyncio.to_thread(verify_face, f_bytes, l_bytes, logs, faceThreshold) if l_bytes else None
    liveness_task = asyncio.to_thread(evaluate_real_liveness, l_bytes, logs) if l_bytes else None

    # Gather tasks concurrently
    if face_task and liveness_task:
        ocr_res, tamper_res, face_res, liveness_res = await asyncio.gather(
            ocr_task, tamper_task, face_task, liveness_task
        )
    else:
        ocr_res, tamper_res = await asyncio.gather(ocr_task, tamper_task)
        face_res = {
            "matched": False,
            "status": "FACE_NOT_PROVIDED",
            "similarity_score": 0.0,
            "distance": 1.0,
            "detail": "No live capture photo provided"
        }
        liveness_res = {
            "liveness_passed": False,
            "liveness_status": "NO_LIVE_PHOTO",
            "liveness_score": 0,
            "blink_detected": False,
            "motion_detected": False,
            "detail": "No live capture photo provided"
        }

    # 3. Sequential Dependent Tasks
    # Module 2: Document Validation (MRZ checksums + format checks)
    val_res = validate_document(ocr_res, logs)

    # Module 5: Risk Scoring Engine
    risk_res = compute_risk_score(ocr_res, val_res, tamper_res, face_res, liveness_res, logs)

    return {
        "ocr": ocr_res,
        "validation": val_res,
        "tamper": tamper_res,
        "tampering": tamper_res,
        "face": face_res,
        "liveness": liveness_res,
        "risk": risk_res,
        "logs": logs
    }

@router.post("/extract")
@router.post("/document/extract")
async def extract_document_api(
    documentType: str = Form("AUTO_DETECT"),
    file: UploadFile = File(None),
    document: UploadFile = File(None)
):
    """
    Dedicated AI Document & Identity Data Extraction API adhering to Section 17.
    Accepts JPG, PNG, WEBP, PDF.
    Returns: document_type, fields, mrz, cross_validation, quality_metrics, raw_ocr, warnings.
    """
    doc_file = file or document
    validate_uploaded_file(doc_file, "Document")
    contents = await doc_file.read() if doc_file else b""
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document file is required for extraction"
        )
    logs = []
    res = extract_ocr_fields(contents, documentType, logs)
    
    classification = res.get("classification", {})
    mrz_res = res.get("mrz_result", {})
    raw_mrz = mrz_res.get("raw_mrz", [])
    
    return {
        "success": res.get("success", False),
        "document_type": {
            "value": res.get("document_type", "Unknown document"),
            "confidence": classification.get("confidence", 0.0),
            "is_confident": classification.get("is_confident", False)
        },
        "fields": res.get("structured_fields", {}),
        "mrz": {
            "line1": raw_mrz[0] if len(raw_mrz) > 0 else None,
            "line2": raw_mrz[1] if len(raw_mrz) > 1 else None,
            "line3": raw_mrz[2] if len(raw_mrz) > 2 else None,
            "valid": mrz_res.get("valid", False),
            "checksum_details": mrz_res.get("checksum_details", {})
        },
        "cross_validation": res.get("cross_validation", {}),
        "quality_metrics": res.get("quality_metrics", {}),
        "multiple_documents": res.get("multiple_documents", []),
        "raw_ocr": res.get("raw_text", ""),
        "raw_blocks": res.get("raw_blocks", []),
        "warnings": res.get("warnings", []),
        "ocr_engine": res.get("ocr_engine", "NONE")
    }

