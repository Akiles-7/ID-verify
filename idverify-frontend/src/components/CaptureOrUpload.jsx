import React, { useState } from "react";
import useCameraCapture from "../hooks/useCameraCapture";
import { UploadCloud, Camera, X, CheckCircle, RefreshCw } from "lucide-react";

/**
 * CaptureOrUpload — Component allowing either file drag-and-drop/browse OR live camera capture.
 * Used for both Document upload (Step 1) and Selfie capture (Step 2).
 */
export default function CaptureOrUpload({
  label,
  accept = "image/*",
  onFileReady,
  currentFile = null,
  currentPreview = null,
  onClear = null,
  facingMode = "user",
  buttonText = "Take Photo",
}) {
  const [mode, setMode] = useState("choose"); // "choose" | "camera"
  const { videoRef, isActive, error, startCamera, stopCamera, captureFrame } = useCameraCapture();

  const handleStartCam = () => {
    setMode("camera");
    startCamera(facingMode);
  };

  const handleCloseCam = () => {
    stopCamera();
    setMode("choose");
  };

  const handleCapture = async () => {
    const blob = await captureFrame();
    if (blob) {
      const file = new File([blob], `captured_${Date.now()}.jpg`, { type: "image/jpeg" });
      onFileReady(file, blob);
      handleCloseCam();
    }
  };

  if (mode === "camera") {
    return (
      <div className="p-5 border-2 border-dashed border-[#2E6BE6] rounded-3xl bg-blue-50/30 text-center animate-slide-in">
        <div className="relative max-w-lg mx-auto overflow-hidden rounded-2xl bg-black mb-4 border border-slate-700 shadow-md">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover"
          />
          {!isActive && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-mono">
              Starting camera feed...
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 mb-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleCapture}
            disabled={!isActive}
            className="px-5 py-2.5 bg-[#2E6BE6] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>Capture Photo</span>
          </button>
          <button
            type="button"
            onClick={handleCloseCam}
            className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-xs rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (currentFile || currentPreview) {
    return (
      <div className="flex items-center gap-4 p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl animate-slide-in">
        {currentPreview ? (
          <img
            src={currentPreview}
            alt="Preview"
            className="w-24 h-20 object-cover rounded-xl border border-emerald-200 shadow-sm"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-8 h-8" />
          </div>
        )}
        <div className="flex-1">
          <div className="font-bold text-emerald-800 text-sm flex items-center gap-1.5">
            <span>{currentFile?.name || "Photo Captured ✓"}</span>
          </div>
          <div className="text-xs text-emerald-600 font-mono mt-0.5">
            {currentFile?.size ? `${(currentFile.size / 1024).toFixed(0)} KB · ` : ""}Ready for analysis
          </div>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-2 rounded-xl text-red-500 hover:bg-red-100 transition-colors"
            title="Remove"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* File Upload Option */}
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl p-6 bg-white hover:bg-blue-50/20 transition-all cursor-pointer group">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2E6BE6] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="text-xs font-bold text-gray-800 mb-0.5">Upload File</div>
        <div className="text-[11px] text-gray-400 font-mono mb-2">JPEG, PNG, BMP (Max 15MB)</div>
        <span className="text-xs text-[#2E6BE6] font-semibold underline">Browse Files</span>
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              const file = e.target.files[0];
              onFileReady(file, null);
            }
          }}
        />
      </label>

      {/* Camera Capture Option */}
      <button
        type="button"
        onClick={handleStartCam}
        className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl p-6 bg-white hover:bg-blue-50/20 transition-all group"
      >
        <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
          <Camera className="w-6 h-6" />
        </div>
        <div className="text-xs font-bold text-gray-800 mb-0.5">{buttonText}</div>
        <div className="text-[11px] text-gray-400 font-mono mb-2">Use device webcam</div>
        <span className="text-xs text-purple-600 font-semibold underline">Open Camera Feed</span>
      </button>
    </div>
  );
}
