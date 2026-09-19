# app/config.py
class Config:
    DEFAULT_FACE_THRESHOLD: float = 0.40
    DEFAULT_ELA_QUALITY: int = 70
    DEFAULT_WEIGHT_MRZ: float = 0.30
    DEFAULT_WEIGHT_TAMPER: float = 0.35
    DEFAULT_WEIGHT_FACE: float = 0.25
    DEFAULT_WEIGHT_VALIDATION: float = 0.10
    RISK_HIGH_THRESHOLD: int = 60
    RISK_MEDIUM_THRESHOLD: int = 30

config = Config()
