import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

/**
 * TamperHeatmap — Module 3: Tampering Detection
 * Shows real ELA heatmap (base64 from AI), real EXIF data, and real hotspots.
 * No hardcoded fake hotspots or fake EXIF values.
 */
export default function TamperHeatmap({ data }) {
  const [activeTab, setActiveTab] = useState('ela');

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full justify-center items-center text-gray-500 text-sm">
        No tampering analysis data available for this document.
      </div>
    );
  }

  const tamper = data;
  let exif = tamper.exif_flags || {};
  if (typeof exif === 'string') {
    try { exif = JSON.parse(exif); } catch { exif = {}; }
  }
  let hotspots = tamper.hotspots || [];
  if (typeof hotspots === 'string') {
    try { hotspots = JSON.parse(hotspots); } catch { hotspots = []; }
  }

  const elaScore = tamper.ela_score ?? 0;
  const metadataScore = (tamper.metadata_score != null && tamper.metadata_score > 0)
    ? tamper.metadata_score
    : (exif.metadata_stripped ? 55 : (exif.exif_score || 0));
  const regionScore = tamper.region_consistency_score ?? 0;

  const rawConf = tamper.overall_tamper_confidence ?? tamper.overall_tamper_score;
  const conf = rawConf != null && rawConf > 0 
    ? rawConf 
    : Math.max(Math.round(elaScore * 0.95), Math.round(metadataScore * 0.90));
  const isSuspicious = conf >= 40 || elaScore >= 45 || metadataScore >= 45;

  const statusBadge = isSuspicious
    ? `bg-red-50 text-red-600 border border-red-200`
    : `bg-emerald-50 text-emerald-600 border border-emerald-200`;
  const statusText = isSuspicious ? `SUSPICIOUS ${conf}%` : `CLEAN ${conf}%`;

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Module Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">MODULE 3</span>
          <h3 className="text-base font-bold text-gray-900">Tampering Detection</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge}`}>
          {isSuspicious ? <ShieldAlert className="inline w-3.5 h-3.5 mr-1" /> : <ShieldCheck className="inline w-3.5 h-3.5 mr-1" />}
          {statusText}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-4">
        {['ela', 'exif', 'flags'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 capitalize ${
              activeTab === tab ? 'border-[#2E6BE6] text-[#2E6BE6]' : 'border-transparent text-gray-500'
            }`}
          >
            {tab === 'ela' ? 'ELA Heatmap' : tab === 'exif' ? 'EXIF Data' : 'Flags'}
          </button>
        ))}
      </div>

      {/* ELA Heatmap */}
      {activeTab === 'ela' && (
        <div className="space-y-4">
          <div className="text-[11px] text-gray-500">
            Red = edited regions · Intensity = tampering confidence
          </div>

          {/* Real ELA heatmap image from AI */}
          <div className="relative bg-[#0F1A33] rounded-xl h-48 border border-[#1B2A4A] overflow-hidden flex items-center justify-center">
            {tamper.heatmap_b64 ? (
              <img
                src={tamper.heatmap_b64}
                alt="ELA Heatmap"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center text-gray-500">
                <div className="text-xs font-mono">ELA heatmap not available</div>
                <div className="text-[10px] text-gray-600 mt-1">Image may be PNG (lossless, ELA not applicable)</div>
              </div>
            )}
            <div className="absolute bottom-2 right-2 text-[9px] font-mono text-gray-400 bg-gray-900/80 px-2 py-0.5 rounded">
              ELA DIFF · Q{tamper.ela_quality || 70} BASELINE
            </div>
          </div>

          {/* Score Bars from real analysis */}
          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-900">Error Level Analysis (ELA)</span>
                <span className={`font-bold ${tamper.ela_score > 40 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {tamper.ela_score}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${tamper.ela_score > 40 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${tamper.ela_score}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Pixel-level JPEG recompression delta</p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-900">Metadata / EXIF</span>
                <span className={`font-bold ${metadataScore >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {metadataScore}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${metadataScore >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${metadataScore}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {exif.software ? `Edited with: ${exif.software}` : exif.metadata_stripped ? 'EXIF metadata stripped (suspicious)' : 'EXIF metadata present'}
              </p>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-gray-900">Edge / Region Consistency</span>
                <span className={`font-bold ${tamper.region_consistency_score > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {tamper.region_consistency_score}%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${tamper.region_consistency_score > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${tamper.region_consistency_score}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Canny edge density analysis</p>
            </div>
          </div>
        </div>
      )}

      {/* EXIF Data — real values from the document */}
      {activeTab === 'exif' && (
        <div className="bg-gray-50 p-4 rounded-xl font-mono text-xs text-gray-700 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Software:</span>
            <span className={exif.software ? 'text-red-600 font-bold' : 'text-gray-600'}>
              {exif.software || 'Not present'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">EXIF Stripped:</span>
            <span className={exif.metadata_stripped ? 'text-amber-600 font-bold' : 'text-gray-600'}>
              {exif.metadata_stripped ? 'Yes — suspicious' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">EXIF Risk Score:</span>
            <span className={metadataScore >= 40 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
              {metadataScore}% {metadataScore >= 40 ? '(Suspicious)' : '(Clean)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Suspicious Software:</span>
            <span className={exif.software && ['photoshop','gimp','pixelmator','affinity'].some(s => (exif.software || '').includes(s)) ? 'text-red-600 font-bold' : 'text-emerald-600'}>
              {exif.software && ['photoshop','gimp','pixelmator','affinity','paint.net'].some(s => (exif.software || '').toLowerCase().includes(s))
                ? 'YES — image editing software detected'
                : 'No editing software detected'}
            </span>
          </div>
          {Object.keys(exif).filter(k => !['software', 'metadata_stripped', 'exif_score'].includes(k)).map(k => (
            <div key={k} className="flex justify-between">
              <span className="text-gray-400">{k}:</span>
              <span>{String(exif[k])}</span>
            </div>
          ))}
        </div>
      )}

      {/* Flags — real hotspots from ELA */}
      {activeTab === 'flags' && (
        <div className="space-y-2 text-xs">
          {hotspots.length === 0 ? (
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
              ✓ No anomaly regions detected — document appears unaltered
            </div>
          ) : (
            hotspots.map((h, i) => (
              <div key={i} className={`p-2.5 rounded-lg font-semibold border ${h.confidence > 70 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                ⚠ {h.label} — {h.confidence}% confidence
                {h.bbox && (
                  <span className="ml-2 font-normal text-[10px] opacity-70">
                    (Region: [{h.bbox.join(', ')}])
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
