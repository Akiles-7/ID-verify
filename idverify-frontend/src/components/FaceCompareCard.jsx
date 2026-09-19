import React from 'react';
import { UserCircle2 } from 'lucide-react';

/**
 * FaceCompareCard — Module 4: Face & Liveness
 * Shows real face comparison results from DeepFace.
 * Uses actual document face crop and live photo — no placeholder Unsplash images.
 */
export default function FaceCompareCard({ data, docImageUrl, liveImageUrl }) {
  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full justify-center items-center text-gray-500 text-sm">
        No face verification data available for this case.
      </div>
    );
  }

  const face = data;
  const comparisonDone = face.comparison_performed === true && face.distance !== null && face.distance !== undefined;
  const isMatch = comparisonDone ? (face.match ?? false) : null;
  const simPct = comparisonDone && face.distance !== null
    ? Math.max(0, Math.min(100, Math.round((1 - face.distance) * 100)))
    : null;

  const embPreview = face.embedding_preview;

  // Status badge
  let statusBadge = { text: 'NOT PERFORMED', cls: 'bg-gray-100 text-gray-500 border-gray-200' };
  if (comparisonDone) {
    statusBadge = isMatch
      ? { text: 'MATCH', cls: 'bg-emerald-50 text-emerald-600 border border-emerald-200' }
      : { text: 'NO MATCH', cls: 'bg-red-50 text-red-600 border border-red-200' };
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Module Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">MODULE 4</span>
          <h3 className="text-base font-bold text-gray-900">Face Verification</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusBadge.cls}`}>
          {statusBadge.text}
        </span>
      </div>

      {face.status === 'SUCCESS_FALLBACK_DLIB' && (
        <div className="mb-3 -mt-2 text-[10px] font-semibold text-amber-600">
          ⚠ Primary matcher unavailable — verified using backup engine (dlib / face_recognition)
        </div>
      )}

      {/* Face Compare Layout */}
      <div className="grid grid-cols-3 gap-3 items-center mb-6">
        {/* Document Photo */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-24 rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200 shadow-inner flex items-center justify-center">
            {docImageUrl ? (
              <img
                src={docImageUrl}
                alt="Document Photo"
                className="w-full h-full object-cover grayscale"
              />
            ) : (
              <div className="flex flex-col items-center text-gray-300">
                <UserCircle2 className="w-10 h-10" />
                <span className="text-[9px] mt-1 text-center leading-tight">No face in doc</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2">DOCUMENT</span>
        </div>

        {/* Center Similarity Gauge */}
        <div className="flex flex-col items-center justify-center text-center">
          {comparisonDone && simPct !== null ? (
            <>
              <div className="relative w-24 h-24 flex items-center justify-center my-1">
                <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={isMatch ? 'text-emerald-500' : 'text-red-500'}
                    strokeDasharray={`${simPct}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-black text-gray-900 leading-none">{simPct}%</span>
                  <span className="text-[8px] font-bold text-gray-400 uppercase mt-0.5">MATCH</span>
                </div>
              </div>
              <span className={`text-[9px] font-extrabold uppercase tracking-wide mt-2 px-2 py-0.5 rounded-full border ${
                isMatch ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {isMatch ? 'MATCH CONFIRMED' : 'IDENTITY MISMATCH'}
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-400">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                <span className="text-[9px] font-bold text-center leading-tight">NO<br/>COMPARE</span>
              </div>
              <span className="text-[10px] text-gray-400">No live photo</span>
            </div>
          )}
        </div>

        {/* Live Capture */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-24 rounded-xl overflow-hidden bg-gray-100 border-2 border-gray-200 shadow-inner flex items-center justify-center">
            {liveImageUrl ? (
              <img
                src={liveImageUrl}
                alt="Live Capture"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center text-gray-300">
                <UserCircle2 className="w-10 h-10" />
                <span className="text-[9px] mt-1 text-center leading-tight">No live photo</span>
              </div>
            )}
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2">LIVE CAPTURE</span>
        </div>
      </div>

      {/* Embedding Divergence */}
      {embPreview && embPreview.length > 0 ? (
        <div className="mb-5">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
            EMBEDDING DIVERGENCE ({face.embedding_dim || 512}-DIM → {embPreview.length} SHOWN)
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 h-12 flex items-end gap-1">
            {embPreview.map((val, idx) => {
              const normalized = Math.abs(val) * 200;
              const clamped = Math.min(100, Math.max(5, normalized));
              return (
                <div key={idx} className="flex-1 flex flex-col justify-end h-full gap-0.5">
                  <div className="w-full bg-blue-500 rounded-t-sm" style={{ height: `${clamped}%` }} />
                  <div className="w-full bg-red-400 rounded-b-sm" style={{ height: `${Math.max(5, 100 - clamped)}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-start gap-4 text-[10px] text-gray-500 mt-2">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /><span>Document</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /><span>Live Capture</span></div>
          </div>
        </div>
      ) : (
        <div className="mb-5 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-400">
          Embedding preview not available{!comparisonDone ? ' — no face comparison was performed' : ''}.
        </div>
      )}

      {/* Metric Tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`${comparisonDone && !isMatch ? 'bg-red-50/60 border-red-200' : 'bg-gray-50 border-gray-100'} border p-2.5 rounded-xl`}>
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DISTANCE</div>
          <div className={`text-sm font-extrabold font-mono ${comparisonDone && !isMatch ? 'text-red-600' : 'text-gray-700'}`}>
            {face.distance !== null && face.distance !== undefined ? face.distance : 'N/A'}
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">THRESHOLD</div>
          <div className="text-sm font-semibold text-gray-900 font-mono">
            ≤ {face.threshold} ({face.model?.split('/')[1]?.trim() || 'ArcFace'})
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">MODEL</div>
          <div className="text-xs font-semibold text-gray-900 font-mono truncate">{face.model}</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">EMBEDDING DIM</div>
          <div className="text-xs font-semibold text-gray-900 font-mono">{face.embedding_dim || 0}-dimensional</div>
        </div>
        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">DOC CONFIDENCE</div>
          <div className="text-xs font-semibold text-gray-900 font-mono">
            {face.doc_confidence !== null && face.doc_confidence !== undefined ? face.doc_confidence.toFixed(2) : 'N/A'}
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LIVE CONFIDENCE</div>
          <div className="text-xs font-semibold text-gray-900 font-mono">
            {face.live_confidence !== null && face.live_confidence !== undefined ? face.live_confidence.toFixed(2) : 'N/A'}
          </div>
        </div>
      </div>

      {!comparisonDone && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
          <strong>Face comparison not performed.</strong>{' '}
          {face.status === 'NO_DOCUMENT_PHOTO'
            ? 'No profile photo could be detected on the document template.'
            : face.status === 'EMPTY_CROP'
            ? 'Face crop region was invalid or empty.'
            : 'No live selfie was provided. To enable biometric face matching, capture a live photo on the New Scan page before running analysis.'}
        </div>
      )}

      {/* MediaPipe Real Liveness section */}
      {livenessData && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <div className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase mb-3">
            Passive Liveness Telemetry (MediaPipe)
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={`p-2.5 rounded-xl border ${livenessData.liveness_passed ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LIVENESS STATUS</div>
              <div className={`text-sm font-extrabold font-mono ${livenessData.liveness_passed ? 'text-emerald-700' : 'text-red-600'}`}>
                {livenessData.liveness_status || 'UNKNOWN'}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-2.5 rounded-xl">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">LIVENESS SCORE</div>
              <div className="text-sm font-semibold text-gray-900 font-mono">
                {livenessData.liveness_score}/100
              </div>
            </div>
            <div className={`bg-gray-50 border border-gray-100 p-2.5 rounded-xl`}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BLINK EAR</div>
              <div className="text-xs font-semibold text-gray-900 font-mono">
                {livenessData.ear_score !== undefined ? livenessData.ear_score.toFixed(3) : 'N/A'} 
                {livenessData.blink_detected ? ' (Blink)' : ' (Open)'}
              </div>
            </div>
            <div className={`bg-gray-50 border border-gray-100 p-2.5 rounded-xl`}>
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">HEAD YAW</div>
              <div className="text-xs font-semibold text-gray-900 font-mono">
                {livenessData.head_yaw_deg !== undefined ? `${livenessData.head_yaw_deg.toFixed(1)}°` : 'N/A'}
                {livenessData.motion_detected ? ' (Motion)' : ''}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
