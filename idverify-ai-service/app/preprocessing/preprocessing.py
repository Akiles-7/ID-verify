# app/preprocessing/preprocessing.py
import cv2
import numpy as np
from typing import Dict, Any, Tuple, List, Optional

def analyze_image_quality(image: np.ndarray) -> Dict[str, Any]:
    """
    Computes image quality metrics:
    - laplacian_var: Sharpness metric (Laplacian variance)
    - fft_score: High frequency spectral energy ratio (detects motion blur)
    - brightness: Mean luminosity
    - contrast: Standard deviation of luminosity
    - blur_level: 'sharp', 'moderate_blur', 'severe_blur'
    """
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        # 1. Laplacian variance
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        
        # 2. FFT High-Frequency Energy Ratio
        h, w = gray.shape
        f = np.fft.fft2(gray)
        fshift = np.fft.fftshift(f)
        magnitude_spectrum = 20 * np.log(np.abs(fshift) + 1e-8)
        
        cx, cy = w // 2, h // 2
        r = min(cx, cy) // 4
        # Mask out center (low frequencies)
        mask = np.ones((h, w), dtype=np.uint8)
        cv2.circle(mask, (cx, cy), r, 0, -1)
        
        fft_high_freq = float(np.mean(magnitude_spectrum * mask))
        
        # 3. Brightness & Contrast
        mean_lum = float(np.mean(gray))
        std_lum = float(np.std(gray))
        
        # Categorize blur
        if lap_var > 180.0:
            blur_level = "sharp"
        elif lap_var > 60.0:
            blur_level = "moderate_blur"
        else:
            blur_level = "severe_blur"
            
        return {
            "laplacian_var": round(lap_var, 2),
            "fft_score": round(fft_high_freq, 2),
            "brightness": round(mean_lum, 2),
            "contrast": round(std_lum, 2),
            "blur_level": blur_level,
            "width": w,
            "height": h
        }
    except Exception as ex:
        return {
            "laplacian_var": 100.0,
            "fft_score": 10.0,
            "brightness": 128.0,
            "contrast": 50.0,
            "blur_level": "moderate_blur",
            "width": image.shape[1] if hasattr(image, 'shape') else 0,
            "height": image.shape[0] if hasattr(image, 'shape') else 0,
            "error": str(ex)
        }

def deskew_image(image: np.ndarray) -> Tuple[np.ndarray, float]:
    """Auto-deskew using Hough Line transform. Returns (deskewed_image, angle_deg)."""
    try:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(edges, 1, np.pi / 180, 100, minLineLength=100, maxLineGap=10)
        
        if lines is None:
            return image, 0.0

        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.arctan2(y2 - y1, x2 - x1) * 180.0 / np.pi
            if abs(angle) < 45:
                angles.append(angle)

        if not angles:
            return image, 0.0

        median_angle = float(np.median(angles))
        if abs(median_angle) < 0.5:
            return image, 0.0
            
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated, round(median_angle, 1)
    except Exception:
        return image, 0.0

def detect_and_warp_document(image: np.ndarray) -> Tuple[np.ndarray, bool]:
    """
    Detects 4-corner document boundaries using contour analysis and applies
    a 4-point perspective warp. Returns (warped_image, boundary_found_flag).
    """
    try:
        orig = image.copy()
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        
        # Blur & edge detection
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 30, 150)
        
        # Dilate edges to close gaps
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        dilated = cv2.dilate(edged, kernel, iterations=2)
        
        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return image, False
            
        # Sort by area descending
        contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
        
        doc_contour = None
        for c in contours:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.02 * peri, True)
            # Check if 4 points and covers at least 20% of image area
            if len(approx) == 4 and cv2.contourArea(approx) > (0.20 * h * w):
                doc_contour = approx
                break
                
        if doc_contour is None:
            return image, False
            
        pts = doc_contour.reshape(4, 2)
        rect = np.zeros((4, 2), dtype="float32")
        
        # Order points: top-left, top-right, bottom-right, bottom-left
        s = pts.sum(axis=1)
        rect[0] = pts[np.argmin(s)]
        rect[2] = pts[np.argmax(s)]
        
        diff = np.diff(pts, axis=1)
        rect[1] = pts[np.argmin(diff)]
        rect[3] = pts[np.argmax(diff)]
        
        (tl, tr, br, bl) = rect
        
        # Compute dimensions of new warped image
        widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
        widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
        maxWidth = max(int(widthA), int(widthB))
        
        heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
        heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
        maxHeight = max(int(heightA), int(heightB))
        
        dst = np.array([
            [0, 0],
            [maxWidth - 1, 0],
            [maxWidth - 1, maxHeight - 1],
            [0, maxHeight - 1]
        ], dtype="float32")
        
        M = cv2.getPerspectiveTransform(rect, dst)
        warped = cv2.warpPerspective(orig, M, (maxWidth, maxHeight))
        return warped, True
    except Exception:
        return image, False

def normalize_resolution(image: np.ndarray, max_dim: int = 2400, min_dim: int = 1000) -> np.ndarray:
    """Normalizes image dimensions for optimal OCR legibility and memory speed."""
    try:
        h, w = image.shape[:2]
        long_edge = max(h, w)
        short_edge = min(h, w)
        
        # Downscale if excessively large (> 2400px)
        if long_edge > max_dim:
            scale = max_dim / long_edge
            image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        # Upscale if too small (< 1000px)
        elif long_edge < min_dim:
            scale = min_dim / long_edge
            image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)
            
        return image
    except Exception:
        return image

def build_preprocessing_variants(image: np.ndarray, quality: Dict[str, Any]) -> Dict[str, np.ndarray]:
    """
    Generates tailored preprocessing variants optimized for different document areas & OCR engines:
    - variant_a: Color enhanced (LAB CLAHE)
    - variant_b: Grayscale + CLAHE contrast
    - variant_c: Denoised + Adaptive Thresholding (Sauvola/Gaussian)
    - variant_d: Unsharp Masked Binary (Otsu threshold)
    """
    variants = {}
    try:
        # Step 1: Document boundary detection & perspective warp
        warped, boundary_found = detect_and_warp_document(image)
        norm_img = normalize_resolution(warped)
        
        # Step 2: Deskewing
        deskewed, angle = deskew_image(norm_img)
        
        # Variant A: Enhanced Color (LAB CLAHE)
        lab = cv2.cvtColor(deskewed, cv2.COLOR_BGR2LAB)
        l, a, b_ch = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced_lab = cv2.merge((cl, a, b_ch))
        variant_a = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        
        # If blurry, apply unsharp masking to variant A
        if quality.get("blur_level") in ["moderate_blur", "severe_blur"]:
            gaussian = cv2.GaussianBlur(variant_a, (0, 0), 3.0)
            variant_a = cv2.addWeighted(variant_a, 1.5, gaussian, -0.5, 0)
            
        variants["variant_a"] = variant_a
        
        # Variant B: Grayscale + CLAHE
        gray = cv2.cvtColor(deskewed, cv2.COLOR_BGR2GRAY)
        variant_b = clahe.apply(gray)
        variants["variant_b"] = variant_b
        
        # Variant C: Denoised + Adaptive Thresholding
        denoised = cv2.fastNlMeansDenoising(variant_b, None, h=7, templateWindowSize=7, searchWindowSize=21)
        variant_c = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11
        )
        variants["variant_c"] = variant_c
        
        # Variant D: Otsu Binarized Grayscale
        _, variant_d = cv2.threshold(variant_b, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants["variant_d"] = variant_d
        
        return variants
    except Exception:
        # Fallback variants
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
        return {
            "variant_a": image,
            "variant_b": gray,
            "variant_c": gray,
            "variant_d": gray
        }
