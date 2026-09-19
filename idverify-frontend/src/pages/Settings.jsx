import React, { useState, useEffect } from 'react';
import MainLayout, { TopBar } from '../layout/MainLayout';
import { Activity, Check, AlertCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function Settings() {
  const [faceThreshold, setFaceThreshold] = useState(0.40);
  const [selectedModel, setSelectedModel] = useState('ARCFACE');
  const [jpegQuality, setJpegQuality] = useState(70);
  const [cannyEdge, setCannyEdge] = useState(true);
  const [exifScan, setExifScan] = useState(true);
  const [quantCheck, setQuantCheck] = useState(true);
  const [highThreshold, setHighThreshold] = useState(60);
  const [medThreshold, setMedThreshold] = useState(30);
  const [sqliteLog, setSqliteLog] = useState(true);
  const [autoEscalate, setAutoEscalate] = useState(true);
  const [retentionDays, setRetentionDays] = useState('30 days');

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await api.get('/settings');
        if (res.data) {
          setFaceThreshold(res.data.faceMatchThreshold ?? 0.40);
          setSelectedModel(res.data.faceBackendModel || 'ARCFACE');
          setJpegQuality(res.data.elaJpegQuality ?? 70);
          setCannyEdge(res.data.enableCannyEdge ?? true);
          setExifScan(res.data.enableExifScan ?? true);
          setQuantCheck(res.data.enableQuantizationCheck ?? true);
          setHighThreshold(res.data.riskHighThreshold ?? 60);
          setMedThreshold(res.data.riskMediumThreshold ?? 30);
          setSqliteLog(res.data.enableAuditLogSqlite ?? true);
          setAutoEscalate(res.data.autoEscalateHighRisk ?? true);
        }
      } catch {
        // Keeps screenshot default values if backend server initializing
      }
    }
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setSavedMsg('');
      setErrorMsg('');
      await api.put('/settings', {
        faceMatchThreshold: faceThreshold,
        faceBackendModel: selectedModel,
        elaJpegQuality: jpegQuality,
        enableCannyEdge: cannyEdge,
        enableExifScan: exifScan,
        enableQuantizationCheck: quantCheck,
        riskHighThreshold: highThreshold,
        riskMediumThreshold: medThreshold,
        enableAuditLogSqlite: sqliteLog,
        autoEscalateHighRisk: autoEscalate,
      });
      setSavedMsg('Configuration saved successfully. Future scans will use these updated parameters.');
      setTimeout(() => setSavedMsg(''), 4000);
    } catch {
      setErrorMsg('Failed to save configuration. Please ensure the backend server is running.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <TopBar
        title="System Configuration"
        subtitle="ADMINISTRATION / SETTINGS · Configure thresholds, models, and audit behaviour"
        actionButton={
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-white text-[#2563EB] font-bold text-xs hover:bg-blue-50 transition-all shadow-md flex items-center gap-2 disabled:opacity-60 active:scale-95 cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#2563EB]" />
            ) : (
              <Check className="w-4 h-4 text-[#2563EB]" />
            )}
            <span>{saving ? 'Saving...' : 'Save configuration'}</span>
          </button>
        }
      />

      {savedMsg && (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{savedMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-2xl text-xs font-bold bg-red-50 text-red-800 border border-red-200 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2x2 Grid Matching Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl">
        {/* 1. FACE VERIFICATION */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase">Face Verification</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Model and match sensitivity</p>
              </div>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>

            {/* Cosine-distance threshold */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-gray-800">Cosine-distance threshold</span>
                <span className="font-mono font-extrabold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md">
                  {Number(faceThreshold).toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.80"
                step="0.05"
                value={faceThreshold}
                onChange={(e) => setFaceThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
              <p className="text-[11px] text-gray-400 mt-2">Lower values enforce stricter facial matching.</p>
            </div>

            {/* BACKEND MODEL */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Backend Model
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none cursor-pointer tracking-wide uppercase transition-all"
                >
                  <option value="ARCFACE">ARCFACE (Recommended)</option>
                  <option value="FACENET">FACENET 512-D</option>
                  <option value="VGGFACE">VGGFACE</option>
                  <option value="OPENFACE">OPENFACE</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 2. TAMPERING DETECTION */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase">Tampering Detection</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Error-level and metadata analysis</p>
              </div>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>

            {/* JPEG recompression quality */}
            <div className="mb-5 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-gray-800">JPEG recompression quality</span>
                <span className="font-mono font-extrabold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md">
                  Q{jpegQuality}
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={jpegQuality}
                onChange={(e) => setJpegQuality(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
              />
            </div>

            {/* Checkbox Rows */}
            <div className="space-y-4">
              {/* Canny edge analysis */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    Canny edge analysis
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Detect inconsistent document boundaries</div>
                </div>
                <input
                  type="checkbox"
                  checked={cannyEdge}
                  onChange={(e) => setCannyEdge(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-blue-500 cursor-pointer accent-[#2563EB]"
                />
              </label>

              {/* EXIF metadata scan */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    EXIF metadata scan
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Inspect image provenance and edit traces</div>
                </div>
                <input
                  type="checkbox"
                  checked={exifScan}
                  onChange={(e) => setExifScan(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-blue-500 cursor-pointer accent-[#2563EB]"
                />
              </label>

              {/* Quantization table check */}
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    Quantization table check
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Compare JPEG compression signatures</div>
                </div>
                <input
                  type="checkbox"
                  checked={quantCheck}
                  onChange={(e) => setQuantCheck(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-blue-500 cursor-pointer accent-[#2563EB]"
                />
              </label>
            </div>
          </div>
        </div>

        {/* 3. RISK ENGINE */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase">Risk Engine</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Classification boundaries</p>
              </div>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>

            {/* HIGH risk threshold */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-gray-800">HIGH risk threshold</span>
                <span className="font-mono font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                  {highThreshold}
                </span>
              </div>
              <input
                type="range"
                min="40"
                max="90"
                value={highThreshold}
                onChange={(e) => setHighThreshold(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>

            {/* MEDIUM risk threshold */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-gray-800">MEDIUM risk threshold</span>
                <span className="font-mono font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  {medThreshold}
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                value={medThreshold}
                onChange={(e) => setMedThreshold(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Range bar */}
            <div className="bg-gray-900 text-gray-200 p-3 rounded-xl font-mono text-[11px] text-center tracking-wider border border-gray-800 shadow-inner">
              <span className="text-emerald-400">LOW 0–{medThreshold - 1}</span>
              <span className="text-gray-500 mx-2">·</span>
              <span className="text-amber-400">MEDIUM {medThreshold}–{highThreshold - 1}</span>
              <span className="text-gray-500 mx-2">·</span>
              <span className="text-red-400">HIGH {highThreshold}–100</span>
            </div>
          </div>
        </div>

        {/* 4. AUDIT & AUTOMATION */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-5 border-b border-gray-100">
              <div>
                <h3 className="text-xs font-black text-gray-900 tracking-wider uppercase">Audit & Automation</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Retention and officer escalation</p>
              </div>
              <Activity className="w-4 h-4 text-amber-500" />
            </div>

            {/* Checkbox Rows */}
            <div className="space-y-4 mb-5 pb-4 border-b border-gray-100">
              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    Enable SQLite audit log
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Write every scan to the case audit trail</div>
                </div>
                <input
                  type="checkbox"
                  checked={sqliteLog}
                  onChange={(e) => setSqliteLog(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-blue-500 cursor-pointer accent-[#2563EB]"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div>
                  <div className="text-xs font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    Auto-escalate HIGH risk
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Trigger review when the high threshold is reached</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoEscalate}
                  onChange={(e) => setAutoEscalate(e.target.checked)}
                  className="w-4 h-4 rounded text-[#2563EB] focus:ring-blue-500 cursor-pointer accent-[#2563EB]"
                />
              </label>
            </div>

            {/* RETENTION PERIOD */}
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Retention Period
              </label>
              <div className="relative">
                <select
                  value={retentionDays}
                  onChange={(e) => setRetentionDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none cursor-pointer transition-all"
                >
                  <option value="30 days">30 days</option>
                  <option value="60 days">60 days</option>
                  <option value="90 days">90 days</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
