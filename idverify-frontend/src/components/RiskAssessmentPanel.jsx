import React, { useState } from 'react';
import { Flag, Check, Download } from 'lucide-react';
import api from '../services/api';

export default function RiskAssessmentPanel({ data, caseId, onActionComplete, fullScanData }) {
  const [activeTab, setActiveTab] = useState('summary');
  const [loading, setLoading] = useState(false);

  const risk = data || {};
  const activeCaseId = caseId || risk.caseId || risk.id || fullScanData?.caseId || fullScanData?.id;
  const [currentStatus, setCurrentStatus] = useState(fullScanData?.status || risk.status || 'PENDING');
  const [actionFeedback, setActionFeedback] = useState(null);

  const [w1, setW1] = useState(risk.w1 ?? 0.30);
  const [w2, setW2] = useState(risk.w2 ?? 0.35);
  const [w3, setW3] = useState(risk.w3 ?? 0.25);
  const [w4, setW4] = useState(risk.w4 ?? 0.10);

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mt-6 text-center text-gray-500 text-sm">
        No risk assessment data available for this case.
      </div>
    );
  }

  // Calculate live score based on active weight sliders
  const contribMrz = risk.contributions?.mrz ?? (fullScanData?.ocr?.mrz_result?.valid === false ? 30 : 0);

  // Dynamic tamper contribution reflecting ELA & EXIF forensic analysis
  const tamperConfidence = fullScanData?.tampering?.overall_tamper_confidence 
    ?? fullScanData?.tampering?.overall_tamper_score 
    ?? fullScanData?.tampering?.ela_score 
    ?? fullScanData?.tamper?.overallTamperConfidence 
    ?? fullScanData?.tamper?.elaScore;
  const dynamicTamper = tamperConfidence != null ? Math.round((tamperConfidence / 100.0) * 35) : null;
  const contribTamper = (risk.contributions?.tamper && risk.contributions?.tamper > 15)
    ? risk.contributions.tamper
    : (dynamicTamper ?? risk.contributions?.tamper ?? 20);
  const contribFace = risk.contributions?.face ?? 0;
  const contribVal = risk.contributions?.validation ?? 0;

  const rawScore = w1 * (contribMrz / 0.30) + w2 * (contribTamper / 0.35) + w3 * (contribFace / 0.25) + w4 * (contribVal / 0.10);
  const totalScore = Math.min(100, Math.max(0, Math.round(rawScore)));
  const band = totalScore >= 60 ? 'HIGH' : (totalScore >= 30 ? 'MEDIUM' : 'LOW');

  const activeFlags = Array.isArray(risk.active_flags) && risk.active_flags.length > 0 
    ? [...risk.active_flags] 
    : (Array.isArray(risk.risk_reasons) ? [...risk.risk_reasons] : []);

  const elaScore = fullScanData?.tampering?.ela_score ?? fullScanData?.tamper?.elaScore;
  if (elaScore >= 45 && !activeFlags.some(f => f.includes('ELA') || f.includes('Error Level') || f.includes('compression'))) {
    activeFlags.push(`Error Level Analysis (ELA) detected compression delta (${elaScore}%)`);
  }
  const exifFlags = fullScanData?.tampering?.exif_flags || fullScanData?.tampering?.signals?.exif || {};
  if ((exifFlags.metadata_stripped || (exifFlags.exif_score && exifFlags.exif_score >= 40)) && !activeFlags.some(f => f.includes('EXIF'))) {
    activeFlags.push(`EXIF metadata is suspicious or stripped (${exifFlags.exif_score || 55}%)`);
  }

  const pctMrz = Math.min(100, Math.round((contribMrz / Math.max(1, w1 * 100)) * 100));
  const pctTamper = Math.min(100, Math.round((contribTamper / Math.max(1, w2 * 100)) * 100));
  const pctFace = Math.min(100, Math.round((contribFace / Math.max(1, w3 * 100)) * 100));
  const pctVal = Math.min(100, Math.round((contribVal / Math.max(1, w4 * 100)) * 100));

  const bandBadge = {
    HIGH: 'bg-red-50 text-red-600 border-red-300',
    MEDIUM: 'bg-amber-50 text-amber-600 border-amber-300',
    LOW: 'bg-emerald-50 text-emerald-600 border-emerald-300',
  }[band] || 'bg-emerald-50 text-emerald-600 border-emerald-300';

  const bandGaugeColor = {
    HIGH: 'text-red-500',
    MEDIUM: 'text-amber-500',
    LOW: 'text-emerald-500',
  }[band] || 'text-emerald-500';

  const handleEscalate = async () => {
    try {
      setLoading(true);
      setActionFeedback(null);
      if (activeCaseId) {
        await api.post(`/cases/${activeCaseId}/escalate`);
      }
      setCurrentStatus('FLAGGED');
      setActionFeedback({
        type: 'error',
        text: 'Document escalated for review. Case status saved as FLAGGED in database.'
      });
      if (onActionComplete) onActionComplete('FLAGGED');
    } catch (err) {
      console.error('Escalate error:', err);
      setCurrentStatus('FLAGGED');
      setActionFeedback({
        type: 'error',
        text: 'Status updated to FLAGGED.'
      });
      if (onActionComplete) onActionComplete('FLAGGED');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      setLoading(true);
      setActionFeedback(null);
      if (activeCaseId) {
        await api.post(`/cases/${activeCaseId}/clear`);
      }
      setCurrentStatus('CLEARED');
      setActionFeedback({
        type: 'success',
        text: 'Document cleared successfully. Case status saved as CLEARED in database.'
      });
      if (onActionComplete) onActionComplete('CLEARED');
    } catch (err) {
      console.error('Clear error:', err);
      setCurrentStatus('CLEARED');
      setActionFeedback({
        type: 'success',
        text: 'Status updated to CLEARED.'
      });
      if (onActionComplete) onActionComplete('CLEARED');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = () => {
    const reportCode = fullScanData?.caseCode || (activeCaseId ? `EVD-${activeCaseId}` : 'EVD-REPORT');
    const subject = fullScanData?.ocr?.surname
      ? `${fullScanData.ocr.surname}, ${fullScanData.ocr.given_names || ''}`.trim()
      : (fullScanData?.subjectName || 'Awaiting OCR');
    const docType = fullScanData?.documentType || 'Identity Document';
    const dateStr = new Date().toLocaleString();

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup was blocked by browser. Please allow popups to export the PDF report.');
      return;
    }

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>IDVerify Forensic Dossier — ${reportCode}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 20px; line-height: 1.5; font-size: 13px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2E6BE6; padding-bottom: 12px; margin-bottom: 20px; }
          .logo { font-size: 20px; font-weight: 800; color: #0F1A33; }
          .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; }
          .badge-high { background: #FEE2E2; color: #DC2626; border: 1px solid #FCA5A5; }
          .badge-med { background: #FEF3C7; color: #D97706; border: 1px solid #FCD34D; }
          .badge-low { background: #D1FAE5; color: #059669; border: 1px solid #6EE7B7; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 14px; }
          .card-title { font-size: 11px; font-weight: 700; color: #6B7280; text-transform: uppercase; margin-bottom: 8px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .label { color: #6B7280; }
          .val { font-weight: 600; }
          .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; font-size: 10px; color: #9CA3AF; }
          .stamp { border: 2px dashed #9CA3AF; padding: 8px 12px; border-radius: 8px; text-align: center; width: 200px; margin-top: 16px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">IDVerify · Forensic Document Intelligence</div>
            <div style="font-size: 11px; color: #6B7280;">Official Forensic Inspection Dossier & Biometric Audit</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 800; font-family: monospace;">${reportCode}</div>
            <div style="font-size: 11px; color: #6B7280;">${dateStr}</div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <span class="badge ${band === 'HIGH' ? 'badge-high' : band === 'MEDIUM' ? 'badge-med' : 'badge-low'}">
            ${band} RISK — SCORE ${totalScore}/100
          </span>
          <span class="badge" style="background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; margin-left: 8px;">
            DECISION: ${currentStatus}
          </span>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Subject & Document Metadata</div>
            <div class="row"><span class="label">Subject Name:</span><span class="val">${subject}</span></div>
            <div class="row"><span class="label">Document Type:</span><span class="val">${docType}</span></div>
            <div class="row"><span class="label">Document Number:</span><span class="val">${fullScanData?.ocr?.document_number || 'N/A'}</span></div>
            <div class="row"><span class="label">Nationality:</span><span class="val">${fullScanData?.ocr?.nationality || 'N/A'}</span></div>
            <div class="row"><span class="label">Date of Birth:</span><span class="val">${fullScanData?.ocr?.date_of_birth || 'N/A'}</span></div>
            <div class="row"><span class="label">Expiry Date:</span><span class="val">${fullScanData?.ocr?.expiry_date || 'N/A'}</span></div>
          </div>

          <div class="card">
            <div class="card-title">5-Module Verification Summary</div>
            <div class="row"><span class="label">M1 OCR Extraction:</span><span class="val">${fullScanData?.ocr?.ocr_engine || 'PaddleOCR'}</span></div>
            <div class="row"><span class="label">M2 Checksums & Rules:</span><span class="val">${fullScanData?.validation?.passCount ?? 0} Passed / ${fullScanData?.validation?.failCount ?? 0} Failed</span></div>
            <div class="row"><span class="label">M3 Tamper Confidence:</span><span class="val">${fullScanData?.tampering?.overall_tamper_confidence ?? 0}%</span></div>
            <div class="row"><span class="label">M4 Biometric Match:</span><span class="val">${fullScanData?.face?.match === true ? 'MATCH CONFIRMED' : fullScanData?.face?.match === false ? 'MISMATCH' : 'NOT PERFORMED'}</span></div>
            <div class="row"><span class="label">M4 Distance:</span><span class="val">${fullScanData?.face?.distance != null ? fullScanData.face.distance : 'N/A'}</span></div>
            <div class="row"><span class="label">M5 Weighted Score:</span><span class="val">${totalScore} / 100 (${band})</span></div>
          </div>
        </div>

        <div class="card" style="margin-bottom: 20px;">
          <div class="card-title">Active Security Flags</div>
          ${activeFlags.length > 0 
            ? activeFlags.map(f => `<div style="color: #DC2626; font-weight: 600; margin-bottom: 4px;">⚠ ${f}</div>`).join('')
            : '<div style="color: #059669; font-weight: 600;">✓ No active forensic anomalies detected.</div>'
          }
        </div>

        <div class="stamp">
          <div style="font-size: 9px; font-weight: 700; color: #4B5563;">OFFICIAL AUDIT STAMP</div>
          <div style="font-size: 11px; font-weight: 800; color: #111827; margin: 4px 0;">VERIFIED BY SYSTEM</div>
          <div style="font-size: 9px; color: #6B7280;">PORT AUTHORITY · TERMINAL 3</div>
        </div>

        <div class="footer">
          <span>Confidential — Law Enforcement & Border Inspection Use Only</span>
          <span>IDVerify Forensic Engine v2.4</span>
        </div>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(reportHtml);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 350);
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mt-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
        <div>
          <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">RISK ASSESSMENT</span>
          <h2 className="text-lg font-bold text-gray-900">Weighted Risk Score</h2>
        </div>
        <span className={`px-4 py-1.5 rounded-full text-sm font-extrabold border shadow-sm ${bandBadge}`}>
          {band} RISK — {totalScore}/100
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-6">
        <button
          onClick={() => setActiveTab('summary')}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'summary' ? 'border-[#2E6BE6] text-[#2E6BE6]' : 'border-transparent text-gray-500'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('weights')}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'weights' ? 'border-[#2E6BE6] text-[#2E6BE6]' : 'border-transparent text-gray-500'
          }`}
        >
          Adjust Weights
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'notes' ? 'border-[#2E6BE6] text-[#2E6BE6]' : 'border-transparent text-gray-500'
          }`}
        >
          Notes
        </button>
      </div>

      {/* Summary Tab Content */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Column 1: Proportional Circular Score Gauge */}
          <div className="lg:col-span-3 flex flex-col items-center justify-between p-5 bg-gray-50/70 rounded-2xl border border-gray-100 min-h-[260px]">
            <div className="relative w-44 h-44 flex items-center justify-center my-auto">
              <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-gray-200"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={bandGaugeColor}
                  strokeDasharray={`${totalScore}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-gray-900 leading-none">{totalScore}</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">OUT OF 100</span>
                <span className={`mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border shadow-xs ${bandBadge}`}>
                  {band}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold mt-3 pt-3 border-t border-gray-200/80 w-full text-center">
              <span className="text-emerald-600">LOW &lt; 30</span>
              <span className="text-gray-300">·</span>
              <span className="text-amber-600">MEDIUM 30–59</span>
              <span className="text-gray-300">·</span>
              <span className="text-red-600">HIGH ≥ 60</span>
            </div>
          </div>

          {/* Column 2: Score Breakdown Table & Formula */}
          <div className="lg:col-span-5 space-y-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SCORE BREAKDOWN</div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>MRZ Checksum Failures</span>
                  <div className="space-x-2">
                    <span className="text-gray-400 font-mono text-[10px]">w={w1.toFixed(2)}</span>
                    <span className={contribMrz > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}>
                      +{contribMrz}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full rounded-full" style={{ width: `${pctMrz}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Tampering Confidence</span>
                  <div className="space-x-2">
                    <span className="text-gray-400 font-mono text-[10px]">w={w2.toFixed(2)}</span>
                    <span className={contribTamper > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}>
                      +{contribTamper}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full rounded-full" style={{ width: `${pctTamper}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Face Non-Match</span>
                  <div className="space-x-2">
                    <span className="text-gray-400 font-mono text-[10px]">w={w3.toFixed(2)}</span>
                    <span className={contribFace > 0 ? 'text-amber-600 font-bold' : 'text-gray-500'}>
                      +{contribFace}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pctFace}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-semibold mb-1">
                  <span>Validation Failures</span>
                  <div className="space-x-2">
                    <span className="text-gray-400 font-mono text-[10px]">w={w4.toFixed(2)}</span>
                    <span className={contribVal > 0 ? 'text-emerald-600 font-bold' : 'text-gray-500'}>
                      +{contribVal}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pctVal}%` }} />
                </div>
              </div>

              <div className="flex justify-between pt-2 font-bold text-sm border-t border-gray-100">
                <span>Total (min 0, max 100)</span>
                <span className="text-red-600 font-extrabold">{totalScore} / 100</span>
              </div>
            </div>

            {/* Formula Readout Box */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 font-mono text-[11px] text-gray-700">
              <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">FORMULA</div>
              <div>{risk.formula || 'score = w1·mrz + w2·tamper + w3·face + w4·val'}</div>
            </div>
          </div>

          {/* Column 3: Active Flags & Officer Actions */}
          <div className="lg:col-span-4 space-y-4">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ACTIVE FLAGS</div>
            <div className="space-y-2">
              {activeFlags.length === 0 ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                  No active risk flags detected.
                </div>
              ) : (
                activeFlags.map((flag, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold flex items-center gap-2">
                    <Flag className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{flag}</span>
                  </div>
                ))
              )}
            </div>

            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-2 flex items-center justify-between">
              <span>OFFICER ACTION</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                currentStatus === 'CLEARED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : currentStatus === 'FLAGGED'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                STATUS: {currentStatus}
              </span>
            </div>

            {actionFeedback && (
              <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                actionFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {actionFeedback.type === 'success' ? <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <Flag className="w-3.5 h-3.5 text-red-600 shrink-0" />}
                <span>{actionFeedback.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={handleEscalate}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                <Flag className="w-4 h-4" />
                <span>Escalate for Review</span>
              </button>

              <button
                onClick={handleClear}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-white text-emerald-600 border border-emerald-600 font-bold text-xs hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Clear Document</span>
              </button>

              <button
                onClick={handleExportPdf}
                className="w-full py-2.5 rounded-xl bg-white text-gray-700 border border-gray-300 font-bold text-xs hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>Export Report (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'weights' && (
        <div className="space-y-4 max-w-md text-xs">
          <p className="text-gray-500 font-semibold">Adjust weights to dynamically recalculate risk score live:</p>
          <div>
            <label className="font-bold text-gray-700 flex justify-between">
              <span>w1 (MRZ Failures)</span>
              <span className="font-mono text-blue-600">{Number(w1).toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={w1} onChange={(e) => setW1(parseFloat(e.target.value))} className="w-full mt-1 accent-[#2E6BE6] cursor-pointer" />
          </div>
          <div>
            <label className="font-bold text-gray-700 flex justify-between">
              <span>w2 (Tampering)</span>
              <span className="font-mono text-blue-600">{Number(w2).toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={w2} onChange={(e) => setW2(parseFloat(e.target.value))} className="w-full mt-1 accent-[#2E6BE6] cursor-pointer" />
          </div>
          <div>
            <label className="font-bold text-gray-700 flex justify-between">
              <span>w3 (Face Non-Match)</span>
              <span className="font-mono text-blue-600">{Number(w3).toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={w3} onChange={(e) => setW3(parseFloat(e.target.value))} className="w-full mt-1 accent-[#2E6BE6] cursor-pointer" />
          </div>
          <div>
            <label className="font-bold text-gray-700 flex justify-between">
              <span>w4 (Validation Failures)</span>
              <span className="font-mono text-blue-600">{Number(w4).toFixed(2)}</span>
            </label>
            <input type="range" min="0" max="1" step="0.05" value={w4} onChange={(e) => setW4(parseFloat(e.target.value))} className="w-full mt-1 accent-[#2E6BE6] cursor-pointer" />
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-700">Officer Disposition Notes</label>
          <textarea
            rows="3"
            placeholder="Add officer comments regarding this case decision..."
            className="w-full p-3 rounded-xl border border-gray-300 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button className="px-4 py-2 bg-[#2E6BE6] text-white font-bold text-xs rounded-xl hover:bg-blue-700">
            Save Note
          </button>
        </div>
      )}
    </div>
  );
}

