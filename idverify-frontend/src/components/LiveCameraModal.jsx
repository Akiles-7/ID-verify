import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/**
 * LiveCameraModal — Uses browser MediaDevices API to access the real webcam.
 * Captures a photo and passes it back as a Blob via onCaptured(blob).
 */
export default function LiveCameraModal({ isOpen, onClose, onCaptured }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [status, setStatus] = useState('idle'); // idle | starting | streaming | captured | error
  const [errorMsg, setErrorMsg] = useState('');
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);

  // Start camera when modal opens
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setStatus('starting');
    setErrorMsg('');
    setCapturedUrl(null);
    setCapturedBlob(null);

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user'
        },
        audio: false
      });

      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('Video play deferred:', e);
        }
      }
      setStatus('streaming');
    } catch (err) {
      console.error('Camera access error:', err);
      let msg = 'Camera access failed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied. Please allow camera access in your browser prompt or settings.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device found on this system.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is already in use by another application or browser tab.';
      } else {
        msg = `Camera error: ${err.message || err.name}`;
      }
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    // Mirror the image for selfie preview
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedUrl(url);
          setCapturedBlob(blob);
          setStatus('captured');
          stopCamera();
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const retake = () => {
    setCapturedUrl(null);
    setCapturedBlob(null);
    setStatus('idle');
    startCamera();
  };

  const handleUseCapture = () => {
    if (capturedBlob) {
      onCaptured(capturedBlob);
    }
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    setCapturedUrl(null);
    setCapturedBlob(null);
    setStatus('idle');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F1A33] text-white rounded-3xl p-6 w-full max-w-xl border border-[#1B2A4A] shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold">Live Camera Capture</h3>
            <p className="text-xs text-gray-400">Position your face clearly in the frame, then click Capture</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport Container */}
        <div className="relative w-full aspect-video bg-gray-950 rounded-2xl border border-[#1B2A4A] overflow-hidden mb-4 flex items-center justify-center">
          {/* Real Video Element (ALWAYS MOUNTED so ref is never null) */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${status === 'streaming' ? 'block' : 'hidden'}`}
            style={{ transform: 'scaleX(-1)' }}
            autoPlay
            playsInline
            muted
          />

          {/* Captured Photo Preview */}
          {status === 'captured' && capturedUrl && (
            <img src={capturedUrl} alt="Captured preview" className="w-full h-full object-cover" />
          )}

          {/* Starting / Requesting Access */}
          {status === 'starting' && (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <div className="text-xs font-semibold text-gray-300">Requesting camera access…</div>
              <div className="text-[11px] text-gray-500 max-w-xs">
                Please click "Allow" in your browser prompt if requested.
              </div>
            </div>
          )}

          {/* Error Message */}
          {status === 'error' && (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-xs text-red-300 max-w-sm">{errorMsg}</p>
              <button
                onClick={startCamera}
                className="mt-1 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Camera Access
              </button>
            </div>
          )}

          {/* Face Alignment Oval Overlay — Streaming */}
          {status === 'streaming' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-44 h-56 border-2 border-dashed border-emerald-400/70 rounded-full flex items-center justify-center bg-emerald-500/5">
                <span className="text-[10px] text-emerald-300 font-mono tracking-widest uppercase bg-black/40 px-2 py-0.5 rounded">
                  Align Face
                </span>
              </div>
            </div>
          )}

          {/* Captured Indicator */}
          {status === 'captured' && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Live Selfie Captured ✓
            </div>
          )}

          {/* Live Indicator — Streaming */}
          {status === 'streaming' && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] font-mono text-emerald-400 bg-black/60 px-3 py-1 rounded-full border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>LIVE CAMERA ACTIVE</span>
            </div>
          )}
        </div>

        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {status === 'captured' && (
              <button
                onClick={retake}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-700 text-white hover:bg-gray-600 transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retake
              </button>
            )}

            {status === 'streaming' && (
              <button
                onClick={capturePhoto}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#2E6BE6] text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-500/30"
              >
                <Camera className="w-4 h-4" />
                Capture Photo
              </button>
            )}

            {status === 'captured' && (
              <button
                onClick={handleUseCapture}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-md shadow-emerald-500/30"
              >
                <CheckCircle2 className="w-4 h-4" />
                Use This Photo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
