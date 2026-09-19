import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout, { TopBar } from '../layout/MainLayout';
import useCameraCapture from '../hooks/useCameraCapture';
import GoogleSpinner from '../components/GoogleSpinner';
import api from '../services/api';
import {
  Play,
  Camera,
  UploadCloud,
  X,
  Activity,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  FileText,
} from 'lucide-react';

/* ───────────────────── 6-Stage Pipeline Header ───────────────────── */

const PIPELINE_STEPS = [
  { id: '01', name: 'DOCUMENT' },
  { id: '02', name: 'OCR' },
  { id: '03', name: 'VALIDATION' },
  { id: '04', name: 'TAMPER ANALYSIS' },
  { id: '05', name: 'FACE VERIFICATION' },
  { id: '06', name: 'RISK ASSESSMENT' },
];

function PipelineStepsHeader() {
  return (
    <div className="bg-white rounded-2xl px-6 py-4 border border-gray-200 shadow-sm mb-6 overflow-x-auto">
      <div className="flex items-center justify-between min-w-[720px] gap-2">
        {PIPELINE_STEPS.map((step, idx) => {
          const isCurrent = step.id === '01';
          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-black ${
                    isCurrent
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {step.id}
                </span>
                <span
                  className={`text-[11px] font-extrabold tracking-wider uppercase ${
                    isCurrent ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {step.name}
                </span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div className="flex-1 h-px bg-gray-200 mx-2" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────── Analysis Progress Modal (Image 2) ───────────────────── */

function getStageDescription(p) {
  if (p < 25) return 'Stage 1/5: 4-Point Warp, OCR & MRZ Extraction...';
  if (p < 50) return 'Stage 2/5: Validating Checksums & Spatial Layout...';
  if (p < 75) return 'Stage 3/5: ELA, EXIF & DCT Tampering Analysis...';
  if (p < 95) return 'Stage 4/5: ArcFace ID & MediaPipe Real Liveness...';
  if (p < 100) return 'Stage 5/5: Computing Composite Risk Ruleset...';
  return 'Analysis Complete ✓ Finalizing Report...';
}

function AnalysisProgressModal({ progress }) {
  const roundedP = Math.round(progress);
  const radius = 62;
  const circumference = 2 * Math.PI * radius; // ~389.55
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Calculate coordinates for the glowing orb along the perimeter
  const angleDeg = (progress / 100) * 360 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const orbX = 90 + radius * Math.cos(angleRad);
  const orbY = 90 + radius * Math.sin(angleRad);

  // 12 tick marks around the perimeter
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
    return {
      x1: 90 + 72 * Math.cos(a),
      y1: 90 + 72 * Math.sin(a),
      x2: 90 + 78 * Math.cos(a),
      y2: 90 + 78 * Math.sin(a),
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
        
        {/* SVG Circular Progress Meter matching Image 2 */}
        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg className="w-full h-full" viewBox="0 0 180 180">
            <defs>
              <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34D399" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
              <filter id="meterGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Perimeter Ticks */}
            {ticks.map((t, idx) => (
              <line
                key={idx}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="#34D399"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.65"
              />
            ))}

            {/* Background Track */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="#F1F5F9"
              strokeWidth="5"
            />

            {/* Progress Arc */}
            <circle
              cx="90"
              cy="90"
              r={radius}
              fill="none"
              stroke="url(#meterGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 90 90)"
              className="transition-all duration-150 ease-out"
            />

            {/* Glowing Orb at Progress Tip */}
            {progress > 1 && (
              <>
                <circle
                  cx={orbX}
                  cy={orbY}
                  r="7"
                  fill="#F59E0B"
                  filter="url(#meterGlow)"
                  className="transition-all duration-150 ease-out"
                />
                <circle
                  cx={orbX}
                  cy={orbY}
                  r="3.5"
                  fill="#FEF3C7"
                  className="transition-all duration-150 ease-out"
                />
              </>
            )}

            {/* Center Percentage Display */}
            <text
              x="90"
              y="98"
              textAnchor="middle"
              fill="#0D9488"
              fontSize="34"
              fontWeight="800"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {roundedP}%
            </text>
          </svg>
        </div>

        {/* Progress Bar & Stage Telemetry matching Image 2 */}
        <div className="mt-4 w-full flex flex-col items-center">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#0D9488] mb-1.5 font-mono">
            PROGRESS
          </span>
          <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full transition-all duration-150 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs font-bold text-gray-700 font-mono tracking-tight min-h-[20px]">
            {getStageDescription(roundedP)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────── Main NewScan Component ──────────────────────── */

export default function NewScan() {
  const [selectedType, setSelectedType] = useState('PASSPORT');
  const [documentFile, setDocumentFile] = useState(null);
  const [docPreview, setDocPreview] = useState(null);
  const [livePhotoBlob, setLivePhotoBlob] = useState(null);
  const [livePhotoPreview, setLivePhotoPreview] = useState(null);

  // Camera modes for document and live selfie
  const [docCamMode, setDocCamMode] = useState('choose'); // 'choose' | 'camera'
  const [selfieCamMode, setSelfieCamMode] = useState('choose'); // 'choose' | 'camera'

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const docFileInputRef = useRef(null);
  const selfieFileInputRef = useRef(null);
  const navigate = useNavigate();

  // Separate camera instances for back/environment and front/user cameras
  const docCam = useCameraCapture();
  const selfieCam = useCameraCapture();

  /* ────────── Document Handlers ────────── */

  const handleDocumentFile = (file) => {
    setError(null);
    if (file) {
      setDocumentFile(file);
      const url = URL.createObjectURL(file);
      setDocPreview(url);
      setDocCamMode('choose');
    }
  };

  const handleStartDocCam = async () => {
    setDocCamMode('camera');
    await docCam.startCamera('environment');
  };

  const handleCloseDocCam = () => {
    docCam.stopCamera();
    setDocCamMode('choose');
  };

  const handleCaptureDocPhoto = async () => {
    const blob = await docCam.captureFrame();
    if (blob) {
      const file = new File([blob], `doc_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleDocumentFile(file);
      handleCloseDocCam();
    }
  };

  const clearDocument = () => {
    setDocumentFile(null);
    setDocPreview(null);
    setDocCamMode('choose');
    if (docFileInputRef.current) docFileInputRef.current.value = '';
  };

  /* ────────── Selfie Handlers ────────── */

  const handleLivePhotoReady = (file, blob) => {
    setError(null);
    const targetBlob = blob || file;
    if (targetBlob) {
      setLivePhotoBlob(targetBlob);
      const url = URL.createObjectURL(targetBlob);
      setLivePhotoPreview(url);
      setSelfieCamMode('choose');
    }
  };

  const handleStartSelfieCam = async () => {
    setLivePhotoBlob(null);
    setLivePhotoPreview(null);
    setSelfieCamMode('camera');
    await selfieCam.startCamera('user');
  };

  const handleCloseSelfieCam = () => {
    selfieCam.stopCamera();
    setSelfieCamMode('choose');
  };

  const handleCaptureSelfiePhoto = async () => {
    const blob = await selfieCam.captureFrame();
    if (blob) {
      const file = new File([blob], `selfie_${Date.now()}.jpg`, { type: 'image/jpeg' });
      handleLivePhotoReady(file, blob);
      handleCloseSelfieCam();
    }
  };

  const clearLivePhoto = () => {
    setLivePhotoBlob(null);
    setLivePhotoPreview(null);
    selfieCam.stopCamera();
    setSelfieCamMode('choose');
    if (selfieFileInputRef.current) selfieFileInputRef.current.value = '';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0.00 MB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const [scanProgress, setScanProgress] = useState(0);
  const progressTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  /* ────────── Submit Scan Handler ────────── */

  const handleStartScan = async () => {
    if (!documentFile) {
      setError('Please provide a document image before starting forensic analysis.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setScanProgress(10);

      // Start smooth progressive timer while awaiting backend response
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = setInterval(() => {
        setScanProgress((prev) => {
          if (prev < 35) return prev + 1;
          if (prev < 65) return prev + 0.5;
          if (prev < 88) return prev + 0.2;
          if (prev < 95) return Math.min(95, prev + 0.08);
          return prev;
        });
      }, 600);

      const formData = new FormData();
      formData.append('documentType', selectedType);
      formData.append('documentImage', documentFile);

      if (livePhotoBlob) {
        formData.append('liveCaptureImage', livePhotoBlob, 'live_capture.jpg');
      }

      const saveRes = await api.post('/scan', formData);
      const caseId = saveRes.data?.caseId;

      // API done — accelerate the timer to fill to 100% before navigating
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      const navTarget = caseId ? `/scan/${caseId}` : '/scan/result';
      const navState = {
        state: {
          docPreviewUrl: docPreview,
          livePreviewUrl: livePhotoPreview,
          documentType: selectedType,
        },
      };
      progressTimerRef.current = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
            setTimeout(() => {
              setLoading(false);
              navigate(navTarget, navState);
            }, 400);
            return 100;
          }
          return Math.min(100, prev + 2);
        });
      }, 80);

    } catch (err) {
      console.error('Scan error:', err);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setLoading(false);
      setScanProgress(0);

      if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
        setError('Cannot connect to backend service. Please ensure Spring Boot service is running.');
      } else if (err.response?.status >= 500) {
        setError(`Server error: ${err.response?.data?.message || 'Internal error during forensic analysis.'}`);
      } else {
        setError('Forensic analysis failed. Check server logs.');
      }
    }
  };

  const docTypes = [
    { id: 'PASSPORT', label: 'Passport' },
    { id: 'DRIVER_LICENSE', label: 'Driver License' },
    { id: 'VISA', label: 'Visa' },
    { id: 'NATIONAL_ID', label: 'National ID' },
  ];

  return (
    <MainLayout>
      <TopBar
        title="Forensic Document Analysis"
        subtitle="Multi-stage neural verification and biometric cross-examination"
      />

      {/* 6-Stage Pipeline Navigation Header */}
      <PipelineStepsHeader />

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-semibold animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 2-Column Main Layout: Document Capture + Biometric Live Capture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ─────────── LEFT COLUMN: DOCUMENT CAPTURE ─────────── */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase">
                  Document Capture
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
                  JPEG · PNG · PDF · BMP · TIFF · maximum 10 MB
                </p>
              </div>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>

            {/* Document Preview / Camera / Choose Box */}
            <div className="relative w-full h-80 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between">
              {docPreview ? (
                /* View 1: Document Uploaded / Captured */
                <>
                  <div className="flex-1 flex items-center justify-center p-3 overflow-hidden">
                    <img
                      src={docPreview}
                      alt="Document preview"
                      className="max-h-64 max-w-full object-contain rounded-lg shadow-md"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={clearDocument}
                    title="Remove document"
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white hover:text-red-400 transition-colors cursor-pointer z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="px-4 py-2.5 bg-slate-900/90 border-t border-slate-800 text-gray-300 flex items-center justify-between font-mono text-[11px]">
                    <span className="truncate max-w-[240px] font-semibold text-white">
                      {documentFile?.name || 'document_upload.jpg'}
                    </span>
                    <span className="text-gray-400">
                      {formatFileSize(documentFile?.size)}
                    </span>
                  </div>
                </>
              ) : docCamMode === 'camera' ? (
                /* View 2: Live Camera Feed for Document */
                <div className="relative w-full h-full flex flex-col justify-between p-3 bg-black">
                  <div className="relative flex-1 w-full overflow-hidden rounded-lg bg-slate-900 flex items-center justify-center">
                    <video
                      ref={docCam.videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!docCam.isActive && !docCam.error && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-mono">
                        Starting camera feed...
                      </div>
                    )}
                    {docCam.error && (
                      <div className="absolute bottom-3 inset-x-3 bg-red-950/90 border border-red-800 text-red-300 p-2 rounded-lg text-[11px] text-center font-medium">
                        {docCam.error}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={handleCaptureDocPhoto}
                      disabled={!docCam.isActive}
                      className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseDocCam}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View 3: Choose Options (Upload File OR Open Camera Feed) */
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 items-center">
                  {/* Option A: Upload File */}
                  <label className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-blue-500 rounded-xl p-4 bg-slate-900/60 hover:bg-slate-900 transition-all cursor-pointer group text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform border border-blue-500/20">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-white mb-0.5">Upload File</div>
                    <div className="text-[10px] text-gray-400 font-mono mb-2">
                      JPEG, PNG, BMP (Max 10MB)
                    </div>
                    <span className="text-xs text-blue-400 font-semibold underline">
                      Browse Files
                    </span>
                    <input
                      ref={docFileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleDocumentFile(e.target.files[0]);
                        }
                      }}
                    />
                  </label>

                  {/* Option B: Take Photo with Camera */}
                  <button
                    type="button"
                    onClick={handleStartDocCam}
                    className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-amber-500 rounded-xl p-4 bg-slate-900/60 hover:bg-slate-900 transition-all cursor-pointer group text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform border border-amber-500/20">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-white mb-0.5">
                      Take Photo of Document
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mb-2">
                      Use device webcam
                    </div>
                    <span className="text-xs text-amber-400 font-semibold underline">
                      Open Camera Feed
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Document Type Selector */}
          <div className="mt-5 pt-4 border-t border-gray-100">
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              Document Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {docTypes.map((dt) => {
                const isSelected = selectedType === dt.id;
                return (
                  <button
                    key={dt.id}
                    type="button"
                    onClick={() => setSelectedType(dt.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 text-amber-600 bg-amber-50/40 shadow-xs ring-1 ring-amber-500/30'
                        : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {dt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─────────── RIGHT COLUMN: BIOMETRIC LIVE CAPTURE ─────────── */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase">
                  Biometric Live Capture
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Optional ArcFace 512-D comparison
                </p>
              </div>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>

            {/* Camera / Photo Area */}
            <div className="relative w-full h-80 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
              {/* CAMERA READY Badge (Displayed when selfie is captured OR camera is actively running) */}
              {(livePhotoPreview || selfieCam.isActive) && (
                <div className="absolute top-3 left-3 z-20">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/85 border border-emerald-500/40 text-emerald-400 text-[10px] font-mono font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    CAMERA READY
                  </span>
                </div>
              )}

              {livePhotoPreview ? (
                /* View 1: Captured Selfie */
                <div className="relative w-full h-full flex items-center justify-center bg-black">
                  <img
                    src={livePhotoPreview}
                    alt="Captured selfie"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearLivePhoto}
                    title="Remove live capture"
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white hover:text-red-400 transition-colors cursor-pointer z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : selfieCamMode === 'camera' ? (
                /* View 2: Active Webcam Stream */
                <div className="relative w-full h-full flex flex-col justify-between p-3 bg-black">
                  <div className="relative flex-1 w-full overflow-hidden rounded-lg bg-slate-900 flex items-center justify-center">
                    <video
                      ref={selfieCam.videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {!selfieCam.isActive && !selfieCam.error && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs font-mono">
                        Starting camera feed...
                      </div>
                    )}
                    {selfieCam.error && (
                      <div className="absolute bottom-3 inset-x-3 bg-red-950/90 border border-red-800 text-red-300 p-2 rounded-lg text-[11px] text-center font-medium">
                        {selfieCam.error}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={handleCaptureSelfiePhoto}
                      disabled={!selfieCam.isActive}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseSelfieCam}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View 3: Choose Options (Take Live Selfie OR Upload Photo) */
                <div className="w-full h-full grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 items-center">
                  {/* Option A: Open Camera Feed */}
                  <button
                    type="button"
                    onClick={handleStartSelfieCam}
                    className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-emerald-500 rounded-xl p-4 bg-slate-900/60 hover:bg-slate-900 transition-all cursor-pointer group text-center"
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform border border-emerald-500/20">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-white mb-0.5">
                      Take Live Selfie
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mb-2">
                      Use device webcam
                    </div>
                    <span className="text-xs text-emerald-400 font-semibold underline">
                      Open Camera Feed
                    </span>
                  </button>

                  {/* Option B: Upload Photo File */}
                  <label className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-blue-500 rounded-xl p-4 bg-slate-900/60 hover:bg-slate-900 transition-all cursor-pointer group text-center">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform border border-blue-500/20">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <div className="text-xs font-bold text-white mb-0.5">Upload Selfie</div>
                    <div className="text-[10px] text-gray-400 font-mono mb-2">
                      JPEG, PNG, BMP (Max 10MB)
                    </div>
                    <span className="text-xs text-blue-400 font-semibold underline">
                      Browse Files
                    </span>
                    <input
                      ref={selfieFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleLivePhotoReady(e.target.files[0], null);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Action Controls & Liveness Detection Indicators */}
          <div className="mt-5 space-y-3">
            {livePhotoPreview ? (
              <button
                type="button"
                onClick={handleStartSelfieCam}
                className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-100 font-bold text-xs transition-all flex items-center justify-center gap-2 border border-gray-800 cursor-pointer active:scale-98 shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake live image</span>
              </button>
            ) : selfieCamMode === 'camera' ? (
              <div className="py-2.5 text-center text-xs text-gray-500 font-mono">
                Position subject centered in frame and click Capture Photo above
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartSelfieCam}
                className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
              >
                <Camera className="w-4 h-4" />
                <span>Open Live Camera Feed</span>
              </button>
            )}

            {/* Honest liveness state: one captured image is not temporal proof. */}
            <div className="grid grid-cols-1 gap-3 font-mono text-[11px]">
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-amber-200 bg-amber-50/70">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="font-semibold text-amber-800">
                  Temporal liveness: multi-frame challenge required; a single selfie is never marked LIVE.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────── BOTTOM BAR: STATUS & RUN ACTION ─────────── */}
      <div className="bg-white rounded-2xl px-6 py-4 border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-gray-600 font-mono flex items-center gap-2">
          {documentFile ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                <strong className="text-gray-900">{documentFile.name}</strong> is ready for the six-stage forensic pipeline.
              </span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-gray-400 shrink-0" />
              <span>Provide document image to enable the six-stage forensic pipeline.</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={handleStartScan}
          disabled={!documentFile || loading}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          <span>Run forensic analysis</span>
        </button>
      </div>

      {/* Analysis Progress Popup Modal matching Image 2 */}
      {loading && <AnalysisProgressModal progress={scanProgress} />}
    </MainLayout>
  );
}
