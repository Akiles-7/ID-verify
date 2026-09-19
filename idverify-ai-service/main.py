import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import ocr, validation, tampering, face, liveness, risk, pipeline, health

logger = logging.getLogger("idverify.startup")

app = FastAPI(
    title="IDVerify AI Forensic Microservice",
    description="Stateless forensic analysis pipeline (Adaptive OCR, ICAO Checksums, Multi-Signal ELA/DCT Tampering, ArcFace Biometrics, MediaPipe Liveness, Risk Scoring)",
    version="3.0.0"
)

# Fix CORS configuration: allow_origin_regex or explicit origins when credentials enabled
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def preload_models():
    logger.info("Preloading AI models at server startup...")
    try:
        from deepface import DeepFace
        logger.info("Warming ArcFace model...")
    except Exception as e:
        logger.warning(f"DeepFace ArcFace warm-up skipped: {e}")

    try:
        from app.modules import ocr_and_validation
        logger.info(f"OCR Engines preloaded: {ocr_and_validation.get_ocr_engine_status()}")
    except Exception as e:
        logger.warning(f"OCR module status probe error: {e}")

app.include_router(ocr.router, prefix="", tags=["OCR"])
app.include_router(validation.router, prefix="", tags=["Validation"])
app.include_router(tampering.router, prefix="", tags=["Tampering"])
app.include_router(face.router, prefix="", tags=["Face Verification"])
app.include_router(liveness.router, prefix="", tags=["Liveness"])
app.include_router(risk.router, prefix="", tags=["Risk Engine"])
app.include_router(pipeline.router, prefix="", tags=["Pipeline Orchestrator"])
app.include_router(health.router, prefix="", tags=["Health"])

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
