# app/modules/face_utils.py
import cv2
import numpy as np
import os
import base64
from PIL import Image
import io

def get_face_cascade():
    """Safely loads OpenCV Haar face cascade classifier without throwing attribute errors."""
    try:
        if hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
            path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            cascade = cv2.CascadeClassifier(path)
            if not cascade.empty():
                return cascade
    except Exception:
        pass

    try:
        cv2_dir = os.path.dirname(cv2.__file__)
        xml_path = os.path.join(cv2_dir, 'data', 'haarcascade_frontalface_default.xml')
        if os.path.exists(xml_path):
            cascade = cv2.CascadeClassifier(xml_path)
            if not cascade.empty():
                return cascade
    except Exception:
        pass

    return None


def looks_like_a_face_region(crop: np.ndarray) -> bool:
    """Sanity check: Verifies a cropped region contains face-like visual variance and aspect ratio."""
    if crop is None or crop.size == 0:
        return False

    h, w = crop.shape[:2]
    if h < 30 or w < 30:
        return False

    # Check aspect ratio (typical headshot aspect ratio is 0.8 to 2.2)
    aspect = h / float(max(1, w))
    if not (0.75 <= aspect <= 2.3):
        return False

    # Check pixel standard deviation (reject flat barcodes, solid fields, blank backgrounds)
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY) if len(crop.shape) == 3 else crop
    std_dev = float(np.std(gray))
    if std_dev < 18.0:
        return False

    return True


_dnn_face_net = None

def get_dnn_face_detector():
    """Loads OpenCV's SSD-based DNN face detector — far more robust than Haar to blur, angle, and low contrast."""
    global _dnn_face_net
    if _dnn_face_net is not None:
        return _dnn_face_net
    models_dir = os.path.join(os.path.dirname(__file__), "models")
    proto_path = os.path.join(models_dir, "deploy.prototxt")
    model_path = os.path.join(models_dir, "res10_300x300_ssd_iter_140000.caffemodel")
    if os.path.exists(proto_path) and os.path.exists(model_path):
        try:
            _dnn_face_net = cv2.dnn.readNetFromCaffe(proto_path, model_path)
        except Exception:
            pass
    return _dnn_face_net


def detect_face_dnn(img: np.ndarray, conf_threshold: float = 0.45):
    """Detects face bounding box using SSD Caffe DNN detector."""
    net = get_dnn_face_detector()
    if net is None:
        return None
    h, w = img.shape[:2]
    try:
        blob = cv2.dnn.blobFromImage(cv2.resize(img, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
        net.setInput(blob)
        detections = net.forward()
        best_box, best_conf = None, 0.0
        for i in range(detections.shape[2]):
            conf = float(detections[0, 0, i, 2])
            if conf > conf_threshold and conf > best_conf:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                best_box = box.astype(int)
                best_conf = conf
        if best_box is not None:
            x1, y1, x2, y2 = best_box
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            return (x1, y1, x2, y2, best_conf)
    except Exception:
        pass
    return None


def estimate_blur(img: np.ndarray) -> float:
    """Variance of Laplacian — lower means blurrier. ~<80 is noticeably blurry for a face crop."""
    if img is None or img.size == 0:
        return 100.0
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def sharpen_if_blurry(img: np.ndarray, threshold: float = 80.0, logs: list = None) -> np.ndarray:
    """Applies unsharp mask contrast/edge enhancement if Laplacian variance is below threshold."""
    if img is None or img.size == 0:
        return img
    blur_score = estimate_blur(img)
    if blur_score < threshold:
        if logs is not None:
            logs.append({"type": "INFO", "text": f"Image sharpness low ({blur_score:.1f}) — applying unsharp mask enhancement"})
        blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=3.0)
        sharpened = cv2.addWeighted(img, 1.5, blurred, -0.5, 0)
        return sharpened
    return img


def trim_text_bleed(crop: np.ndarray) -> np.ndarray:
    """Trims stray barcode/printed text lines bleeding into the bottom edge of a face crop."""
    if crop is None or crop.size == 0:
        return crop
    h, w = crop.shape[:2]
    band_h = int(h * 0.15)
    if band_h < 5:
        return crop
    bottom_band = crop[h - band_h:h, :]
    rest = crop[:h - band_h, :]
    try:
        gray_bottom = cv2.cvtColor(bottom_band, cv2.COLOR_BGR2GRAY) if len(bottom_band.shape) == 3 else bottom_band
        gray_rest = cv2.cvtColor(rest, cv2.COLOR_BGR2GRAY) if len(rest.shape) == 3 else rest
        edges_bottom = float(cv2.Canny(gray_bottom, 80, 160).mean())
        edges_rest = float(cv2.Canny(gray_rest, 80, 160).mean())
        if edges_bottom > max(5.0, edges_rest * 2.3):
            return rest
    except Exception:
        pass
    return crop


def extract_headshot_from_document(doc_img: np.ndarray, logs: list = None) -> np.ndarray | None:
    """Shared Face Extractor: Locates and crops printed headshot photo with DNN, Haar, candidate bounds & sanity validation."""
    if logs is None:
        logs = []

    if doc_img is None or doc_img.size == 0:
        return None

    # Apply unsharp mask if document canvas is blurry
    doc_img = sharpen_if_blurry(doc_img, threshold=80.0, logs=logs)

    h, w = doc_img.shape[:2]

    # 1. Primary: OpenCV Caffe SSD DNN Detector
    dnn_res = detect_face_dnn(doc_img)
    if dnn_res is not None:
        x1, y1, x2, y2, conf = dnn_res
        fw, fh = x2 - x1, y2 - y1
        pad_x = int(fw * 0.20)
        pad_y = int(fh * 0.20)
        cy1 = max(0, y1 - pad_y)
        cy2 = min(h, y2 + pad_y)
        cx1 = max(0, x1 - pad_x)
        cx2 = min(w, x2 + pad_x)
        crop = doc_img[cy1:cy2, cx1:cx2]
        crop = trim_text_bleed(crop)
        if looks_like_a_face_region(crop):
            logs.append({"type": "INFO", "text": f"Face Extractor: Detected face via DNN SSD ({cx2-cx1}×{cy2-cy1}px, conf: {conf:.2f})"})
            return crop

    # 2. Secondary: Haar Cascade detection
    try:
        gray = cv2.cvtColor(doc_img, cv2.COLOR_BGR2GRAY)
        cascade = get_face_cascade()
        if cascade is not None:
            faces = cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(30, 30))
            if len(faces) > 0:
                faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
                fx, fy, fw, fh = faces[0]
                pad_x = int(fw * 0.25)
                pad_y = int(fh * 0.25)
                y1 = max(0, fy - pad_y)
                y2 = min(h, fy + fh + pad_y)
                x1 = max(0, fx - pad_x)
                x2 = min(w, fx + fw + pad_x)
                crop = doc_img[y1:y2, x1:x2]
                crop = trim_text_bleed(crop)
                if looks_like_a_face_region(crop):
                    logs.append({"type": "INFO", "text": f"Face Extractor: Detected face via Haar Cascade ({x2-x1}×{y2-y1}px)"})
                    return crop
    except Exception as e:
        logs.append({"type": "WARN", "text": f"Haar cascade detection skipped: {str(e)[:50]}"})

    # 3. Positional Heuristic Candidates (tightened bounds, y2 <= 0.76*h to avoid barcode region)
    candidates = [
        (int(w * 0.02), int(h * 0.08), int(w * 0.45), int(h * 0.76)),  # Standard left-side photo (y2 <= 0.76*h)
        (int(w * 0.55), int(h * 0.08), int(w * 0.98), int(h * 0.76)),  # Right-side photo
        (int(w * 0.05), int(h * 0.05), int(w * 0.50), int(h * 0.60)),  # Top-left photo
        (int(w * 0.02), int(h * 0.45), int(w * 0.50), int(h * 0.95)),  # Bottom-left photo (Aadhaar composite)
        (int(w * 0.50), int(h * 0.45), int(w * 0.98), int(h * 0.95)),  # Bottom-right photo
    ]

    for x1, y1, x2, y2 in candidates:
        if x2 > x1 + 30 and y2 > y1 + 30:
            crop = doc_img[y1:y2, x1:x2]
            crop = trim_text_bleed(crop)
            if looks_like_a_face_region(crop):
                logs.append({"type": "INFO", "text": f"Face Extractor: Located valid profile photo using template bounds ({x2-x1}×{y2-y1}px)"})
                return crop

    logs.append({"type": "WARN", "text": "Face Extractor: No valid profile photo region located on document canvas"})
    return None


def crop_face_b64_from_doc(doc_img: np.ndarray, logs: list = None) -> str | None:
    """Extracts headshot and returns base64 PNG string for web rendering."""
    crop = extract_headshot_from_document(doc_img, logs)
    if crop is not None and crop.size > 0:
        try:
            face_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            pil = Image.fromarray(face_rgb)
            buf = io.BytesIO()
            pil.save(buf, format="PNG")
            return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        except Exception:
            pass
    return None

