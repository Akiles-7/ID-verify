# app/routers/ocr.py
from fastapi import APIRouter, UploadFile, File, Form
from app.modules.ocr_and_validation import extract_ocr_fields

router = APIRouter()

@router.post("/ocr/extract")
async def extract_ocr(documentType: str = Form("PASSPORT"), file: UploadFile = File(None)):
    contents = await file.read() if file else b""
    res = extract_ocr_fields(contents, documentType)
    # Flatten canonical field values onto the top-level for frontend compatibility.
    # Older persisted responses expect e.g. `ocr.surname` to be a string.
    fields = res.get("fields") or {}
    if isinstance(fields, dict):
        for k, v in fields.items():
            # If the field is an object with a `value` key, expose the raw value
            # on the response top-level as well (e.g. `surname: 'Smith'`).
            try:
                if isinstance(v, dict) and "value" in v:
                    res[k] = v.get("value")
                else:
                    res[k] = v
            except Exception:
                # Never let a single malformed field break the response
                res[k] = None
    return res
