# app/preprocessing/multi_doc_detector.py
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
import pypdfium2 as pdfium

def convert_pdf_to_images(pdf_bytes: bytes, max_pages: int = 2) -> List[np.ndarray]:
    """Converts a PDF file buffer to a list of BGR numpy images using pypdfium2."""
    images = []
    try:
        pdf = pdfium.PdfDocument(pdf_bytes)
        num_pages = min(len(pdf), max_pages)
        for page_idx in range(num_pages):
            page = pdf[page_idx]
            # Render at 300 DPI for crisp text
            bitmap = page.render(scale=300 / 72)
            pil_image = bitmap.to_pil()
            img_bgr = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            images.append(img_bgr)
    except Exception:
        pass
    return images

def decode_image_bytes_to_bgr(data_bytes: bytes) -> Optional[np.ndarray]:
    """Decodes image bytes to OpenCV BGR numpy array using cv2 then PIL fallback."""
    if not data_bytes:
        return None
    try:
        nparr = np.frombuffer(data_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is not None and image.size > 0:
            return image
    except Exception:
        pass
    try:
        from PIL import Image, ImageOps
        import io
        pil_img = Image.open(io.BytesIO(data_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)
        pil_img = pil_img.convert("RGB")
        image = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        if image is not None and image.size > 0:
            return image
    except Exception:
        pass
    return None

def decode_image_or_pdf(data_bytes: bytes) -> List[np.ndarray]:
    """
    Decodes uploaded file bytes.
    If PDF, returns rendered page images.
    If standard image format (JPG, PNG, WEBP, AVIF, BMP, TIFF, etc.), returns a single image.
    """
    if not data_bytes:
        return []
    
    # Check for PDF magic bytes (%PDF)
    if data_bytes.startswith(b"%PDF"):
        pdf_imgs = convert_pdf_to_images(data_bytes)
        if pdf_imgs:
            return pdf_imgs
            
    img = decode_image_bytes_to_bgr(data_bytes)
    if img is not None:
        return [img]
        
    return []

def evaluate_image_quality(image: np.ndarray) -> Dict[str, Any]:
    """
    Comprehensive image quality check before extraction:
    - Resolution (width, height, total megapixels)
    - Blur / Sharpness (Laplacian variance & FFT high-frequency score)
    - Brightness (mean luminosity 0-255)
    - Contrast (std deviation of luminosity)
    - Glare / Overexposure (percentage of near-saturated highlight pixels)
    - Suitability verdict with user-friendly warnings
    """
    h, w = image.shape[:2]
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    
    # 1. Laplacian variance
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    
    # 2. Brightness & Contrast
    mean_brightness = float(np.mean(gray))
    std_contrast = float(np.std(gray))
    
    # 3. Glare detection (fraction of pixels > 245)
    glare_pixels = int(np.sum(gray > 245))
    glare_pct = float(glare_pixels) / float(h * w) * 100.0
    
    # 4. Darkness / Underexposure (fraction of pixels < 20)
    dark_pixels = int(np.sum(gray < 20))
    dark_pct = float(dark_pixels) / float(h * w) * 100.0
    
    # Categorization
    warnings = []
    is_suitable = True
    
    if lap_var < 45.0:
        blur_status = "severe_blur"
        warnings.append("Document image is severely blurred. Text may not be readable.")
        is_suitable = False
    elif lap_var < 95.0:
        blur_status = "moderate_blur"
        warnings.append("Document image has moderate blur. Please verify extracted fields.")
    else:
        blur_status = "sharp"
        
    if mean_brightness < 45.0:
        warnings.append("Image is underexposed or in very low lighting.")
        if mean_brightness < 30.0:
            is_suitable = False
    elif mean_brightness > 225.0:
        warnings.append("Image is overexposed or washed out.")
        
    if glare_pct > 15.0:
        warnings.append(f"Significant glare/reflection detected ({glare_pct:.1f}% area). Key fields may be obscured.")
        
    if min(h, w) < 400:
        warnings.append("Low image resolution. Higher resolution recommended for accurate OCR.")
        if min(h, w) < 250:
            is_suitable = False

    quality_score = 100.0
    if blur_status == "severe_blur":
        quality_score -= 40
    elif blur_status == "moderate_blur":
        quality_score -= 15
    if mean_brightness < 45 or mean_brightness > 220:
        quality_score -= 20
    if glare_pct > 10.0:
        quality_score -= 15
    if min(h, w) < 600:
        quality_score -= 15
    quality_score = max(5.0, min(100.0, quality_score))

    rejection_message = None
    if not is_suitable:
        rejection_message = "Image quality is insufficient for reliable extraction. Please upload a clearer image."

    return {
        "width": w,
        "height": h,
        "sharpness": round(lap_var, 1),
        "blur_status": blur_status,
        "brightness": round(mean_brightness, 1),
        "contrast": round(std_contrast, 1),
        "glare_percentage": round(glare_pct, 1),
        "quality_score": round(quality_score, 1),
        "is_suitable": is_suitable,
        "warnings": warnings,
        "rejection_message": rejection_message
    }

def order_points(pts: np.ndarray) -> np.ndarray:
    """Orders 4 coordinates: top-left, top-right, bottom-right, bottom-left."""
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """Performs perspective transform on image given 4 corner points."""
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    
    if maxWidth < 50 or maxHeight < 50:
        return image
        
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]
    ], dtype="float32")
    
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped

def _boxes_overlap(boxA: List[int], boxB: List[int]) -> bool:
    """Checks if two bounding boxes overlap or if one is inside the other."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])
    interArea = max(0, xB - xA) * max(0, yB - yA)
    if interArea <= 0:
        return False
    areaA = boxA[2] * boxA[3]
    areaB = boxB[2] * boxB[3]
    minArea = min(areaA, areaB)
    # If overlap is > 10% of the smaller box, they are not separate documents
    return (float(interArea) / float(minArea)) > 0.10

def detect_multiple_documents(image: np.ndarray) -> List[Dict[str, Any]]:
    """
    Detects if an image contains multiple separate documents (e.g. Passport + PAN card on scanner).
    Returns list of dicts: [{"id": 1, "image": np.ndarray, "bbox": [x, y, w, h], "area_fraction": float}]
    If no distinct multiple documents are found, returns a single entry with the full image.
    """
    h, w = image.shape[:2]
    img_area = float(h * w)
    
    # If image is small or already standard document size, it is a single document
    if min(h, w) < 500 or img_area < 350000:
        return [{
            "id": 1,
            "image": image,
            "bbox": [0, 0, w, h],
            "area_fraction": 1.0
        }]

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 30, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    dilated = cv2.dilate(edged, kernel, iterations=2)
    
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    doc_candidates = []
    # For multiple documents on one canvas, each doc must occupy a reasonable fraction
    min_doc_area = 0.18 * img_area
    max_doc_area = 0.55 * img_area
    
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_doc_area or area > max_doc_area:
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.03 * peri, True)
        x, y, cw, ch = cv2.boundingRect(c)
        
        aspect_ratio = float(cw) / float(ch) if ch > 0 else 0
        if 0.55 <= aspect_ratio <= 2.1:
            doc_candidates.append({
                "contour": c,
                "approx": approx,
                "area": area,
                "bbox": [int(x), int(y), int(cw), int(ch)]
            })
            
    doc_candidates.sort(key=lambda item: item["area"], reverse=True)
    
    # Only treat as multiple documents if at least 2 candidates are mutually disjoint
    valid_docs = []
    if len(doc_candidates) >= 2:
        non_overlapping = []
        for cand in doc_candidates:
            if not any(_boxes_overlap(cand["bbox"], existing["bbox"]) for existing in non_overlapping):
                non_overlapping.append(cand)
        
        if len(non_overlapping) >= 2:
            for idx, cand in enumerate(non_overlapping[:3]):
                approx = cand["approx"]
                if len(approx) == 4:
                    pts = approx.reshape(4, 2)
                    warped = four_point_transform(image, pts)
                else:
                    x, y, cw, ch = cand["bbox"]
                    # Add small padding margin if possible
                    pad_x = min(10, x)
                    pad_y = min(10, y)
                    x1 = max(0, x - pad_x)
                    y1 = max(0, y - pad_y)
                    x2 = min(w, x + cw + pad_x)
                    y2 = min(h, y + ch + pad_y)
                    warped = image[y1:y2, x1:x2]
                valid_docs.append({
                    "id": idx + 1,
                    "image": warped,
                    "bbox": cand["bbox"],
                    "area_fraction": round(cand["area"] / img_area, 2)
                })

    if len(valid_docs) >= 2:
        return valid_docs
        
    return [{
        "id": 1,
        "image": image,
        "bbox": [0, 0, w, h],
        "area_fraction": 1.0
    }]
