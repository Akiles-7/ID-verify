import React, { useState } from 'react';
import { UploadCloud, Camera, FileText, CreditCard, Award, Sparkles, X } from 'lucide-react';

export function DocumentTypeSelector({ selectedType, onSelect }) {
  const types = [
    { id: 'PASSPORT', label: 'Passport', icon: FileText },
    { id: 'DRIVER_LICENSE', label: 'Driver License', icon: CreditCard },
    { id: 'VISA', label: 'Visa', icon: Award },
    { id: 'NATIONAL_ID', label: 'National ID', icon: Sparkles },
  ];

  return (
    <div className="flex items-center gap-2">
      {types.map((t) => {
        const Icon = t.icon;
        const isSelected = selectedType === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              isSelected
                ? 'bg-[#2E6BE6] text-white border-[#2E6BE6] shadow-md shadow-blue-500/20'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DropzoneUpload({ selectedType, onFileSelect, onDemoClick, onCameraClick }) {
  const docLabels = {
    PASSPORT: 'Passport',
    DRIVER_LICENSE: 'Driver License',
    VISA: 'Visa',
    NATIONAL_ID: 'National ID',
  };

  const currentLabel = docLabels[selectedType] || 'Passport';

  return (
    <div className="border-2 border-dashed border-blue-300 rounded-3xl p-12 text-center bg-blue-50/20 hover:bg-blue-50/40 transition-colors flex flex-col items-center justify-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-100/60 text-[#2E6BE6] flex items-center justify-center mb-4">
        <UploadCloud className="w-8 h-8" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-1">Drop your {currentLabel} here</h3>
      <p className="text-xs text-gray-400 font-mono mb-6">
        JPEG · PNG · WEBP · BMP — max 15 MB
      </p>

      <div className="flex items-center gap-3">
        <label className="px-5 py-2.5 rounded-xl bg-[#2E6BE6] text-white text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">
          Browse & Scan
          <input
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/bmp"
            onChange={(e) => {
              if (e.target.files?.[0]) onFileSelect(e.target.files[0]);
            }}
          />
        </label>

        <button
          type="button"
          onClick={onDemoClick}
          className="px-5 py-2.5 rounded-xl bg-white text-gray-700 border border-gray-300 text-xs font-bold hover:bg-gray-50 transition-colors"
        >
          Use demo document
        </button>

        <button
          type="button"
          onClick={onCameraClick}
          className="px-5 py-2.5 rounded-xl bg-white text-gray-700 border border-gray-300 text-xs font-bold hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Camera className="w-4 h-4 text-gray-500" />
          <span>Live Camera</span>
        </button>
      </div>
    </div>
  );
}

export function LiveCameraModal({ isOpen, onClose, onCaptured }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0F1A33] text-white rounded-3xl p-6 w-full max-w-lg border border-[#1B2A4A] shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-bold mb-1">Live Camera Capture</h3>
        <p className="text-xs text-gray-400 mb-4">Position your face in front of the camera for passive liveness verification.</p>

        <div className="w-full h-64 bg-gray-900 rounded-2xl border border-gray-700 flex items-center justify-center relative overflow-hidden">
          <div className="w-40 h-40 border-2 border-dashed border-emerald-500 rounded-full animate-pulse flex items-center justify-center">
            <span className="text-[10px] text-emerald-400 font-mono">ALIGN FACE</span>
          </div>
          <div className="absolute bottom-3 left-4 text-[11px] font-mono text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Capturing… 12/20 frames · Blink ✓ · Motion ✓</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-800 text-gray-300 hover:bg-gray-700">
            Cancel
          </button>
          <button
            onClick={() => {
              onCaptured('/uploads/live_capture_cam.jpg');
              onClose();
            }}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#2E6BE6] text-white hover:bg-blue-700 shadow-md"
          >
            Use This Capture
          </button>
        </div>
      </div>
    </div>
  );
}
