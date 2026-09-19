import { useRef, useState, useEffect, useCallback } from "react";

/**
 * Custom hook for web camera access, streaming to a video ref, and frame capture.
 * Handles stream lifecycle, browser permissions, and clean unmounting.
 */
export function useCameraCapture() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);

  const startCamera = useCallback(async (facingMode = "user") => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play(); // Explicit play call required by many browsers
      }
      setIsActive(true);
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "Camera permission denied — allow camera access in your browser's site settings and retry."
        : err.name === "NotFoundError"
        ? "No camera device found."
        : `Camera error: ${err.message}`;
      setError(msg);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsActive(false);
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || videoRef.current.videoWidth === 0) return Promise.resolve(null);
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92));
  }, []);

  // Always release the camera when component unmounts
  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, isActive, error, startCamera, stopCamera, captureFrame };
}

export default useCameraCapture;
