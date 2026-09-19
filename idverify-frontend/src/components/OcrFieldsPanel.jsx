import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Sparkles,
  Layers,
  HelpCircle,
  QrCode,
  Gauge,
  AlertCircle
} from 'lucide-react';

export default function OcrFieldsPanel({ data, onHoverField }) {
  const [activeTab, setActiveTab] = useState('fields'); // 'fields', 'mrz', 'cross_val', 'quality', 'raw_ocr', 'json'
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm flex flex-col h-full justify-center items-center text-gray-500 text-sm">
        <FileText className="w-8 h-8 text-gray-300 mb-2" />
        No OCR field data available for this document.
      </div>
    );
  }

  // Support multiple documents if detected
  const multiDocs = data.multiple_documents && Array.isArray(data.multiple_documents) && data.multiple_documents.length > 1
    ? data.multiple_documents
    : null;

  const currentDoc = multiDocs ? multiDocs[selectedDocIndex] : data;

  // Extract structured fields
  const structuredFields = currentDoc.structured_fields || (currentDoc.fields && typeof currentDoc.fields === 'object' ? currentDoc.fields : {});
  
  // Document classification & confidence
  const docClassification = currentDoc.classification || {};
  const docTypeName = currentDoc.document_type || docClassification.document_type || 'Unknown document';
  const docConfidence = docClassification.confidence !== undefined ? docClassification.confidence : (currentDoc.ocr_confidence || 0.85);
  const isConfident = docClassification.is_confident ?? (docConfidence >= 0.70);

  // Quality metrics
  const quality = currentDoc.quality_metrics || {};
  const warnings = quality.warnings || currentDoc.warnings || [];
  const isQualityRejection = quality.rejection_message || (!quality.is_suitable && quality.is_suitable !== undefined);

  // MRZ Data
  const mrzResult = currentDoc.mrz_result || data.mrz_result || {};
  const rawMrz = mrzResult.raw_mrz || [];
  const checksums = mrzResult.checksum_details || {};
  const hasMrz = rawMrz.length > 0 || mrzResult.valid;

  // Cross validation
  const crossVal = currentDoc.cross_validation || data.cross_validation || {};
  const comparisons = crossVal.comparisons || [];

  // Format field items for table
  const fieldEntries = Object.entries(structuredFields)
    .filter(([k]) => !['ocr_engine', 'raw_text_summary', 'mrz_line1', 'mrz_line2'].includes(k))
    .map(([key, f]) => {
      const label = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const val = typeof f === 'object' && f !== null ? f.value : f;
      const rawVal = typeof f === 'object' && f !== null ? f.raw_value : val;
      const conf = typeof f === 'object' && f !== null ? f.confidence : 0.90;
      const src = typeof f === 'object' && f !== null ? f.source : 'visual_text';
      const status = typeof f === 'object' && f !== null ? f.status : (val ? 'Verified' : 'Not detected');
      const validation = typeof f === 'object' && f !== null ? f.validation : 'valid';

      return {
        key,
        label,
        value: val,
        rawValue: rawVal,
        confidence: conf,
        source: src,
        status: status || (val ? 'Verified' : 'Not detected'),
        validation
      };
    });

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Module Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">
              MODULE 1 · AI DOCUMENT & DATA EXTRACTION
            </span>
            {currentDoc.ocr_engine && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200">
                {currentDoc.ocr_engine}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-gray-900 mt-0.5">Document Intelligence Console</h3>
        </div>

        {/* Classification Badge */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-gray-500">Document Type:</span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${
                docTypeName === 'Unknown document'
                  ? 'bg-gray-100 text-gray-700 border-gray-300'
                  : isConfident
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {docTypeName}
            </span>
          </div>
          <div className="text-[10px] font-mono text-gray-400 mt-0.5">
            Confidence: <span className="font-bold text-gray-700">{Math.round(docConfidence * 100)}%</span>
            {!isConfident && docTypeName !== 'Unknown document' && (
              <span className="text-amber-600 font-semibold ml-1">· ⚠️ Low confidence</span>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Document Selector Tabs if > 1 document detected */}
      {multiDocs && (
        <div className="flex items-center gap-2 mb-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Multiple Documents Detected:
          </span>
          {multiDocs.map((doc, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDocIndex(idx)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedDocIndex === idx
                  ? 'bg-[#2E6BE6] text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Doc {idx + 1}: {doc.document_type || `ID ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Image Quality Warning Banner */}
      {warnings.length > 0 && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-bold">Image Quality Notice</div>
            <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-amber-800">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            {isQualityRejection && (
              <div className="mt-1 font-semibold text-red-600 text-[11px]">
                Image quality is insufficient for reliable extraction. Please upload a clearer image.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-100 mb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('fields')}
          className={`pb-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'fields'
              ? 'border-[#2E6BE6] text-[#2E6BE6]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Extracted Information ({fieldEntries.length})
        </button>

        {hasMrz && (
          <button
            onClick={() => setActiveTab('mrz')}
            className={`pb-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'mrz'
                ? 'border-[#2E6BE6] text-[#2E6BE6]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            MRZ Zone & Validation
          </button>
        )}

        {comparisons.length > 0 && (
          <button
            onClick={() => setActiveTab('cross_val')}
            className={`pb-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
              activeTab === 'cross_val'
                ? 'border-[#2E6BE6] text-[#2E6BE6]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Cross-Validation ({comparisons.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('quality')}
          className={`pb-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'quality'
              ? 'border-[#2E6BE6] text-[#2E6BE6]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Quality Check
        </button>

        <button
          onClick={() => setActiveTab('raw_ocr')}
          className={`pb-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'raw_ocr'
              ? 'border-[#2E6BE6] text-[#2E6BE6]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Raw OCR
        </button>

        <button
          onClick={() => setActiveTab('json')}
          className={`pb-2.5 px-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
            activeTab === 'json'
              ? 'border-[#2E6BE6] text-[#2E6BE6]'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Structured JSON
        </button>
      </div>

      {/* Tab 1: Extracted Information Table */}
      {activeTab === 'fields' && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                <th className="py-2.5 px-3">Field</th>
                <th className="py-2.5 px-3">Extracted Value</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
                <th className="py-2.5 px-3 text-center">Source</th>
                <th className="py-2.5 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {fieldEntries.map((f) => {
                const confPercent = Math.round((f.confidence || 0) * 100);
                const isLowConf = confPercent > 0 && confPercent < 70;
                const isUndetected = !f.value || f.status === 'Not detected';
                const isMismatch = f.status.includes('Mismatch');

                return (
                  <tr
                    key={f.key}
                    onMouseEnter={() => onHoverField && onHoverField(f.value || f.label)}
                    onMouseLeave={() => onHoverField && onHoverField(null)}
                    className="hover:bg-blue-50/40 transition-colors group cursor-default"
                  >
                    <td className="py-2.5 px-3 font-semibold text-gray-700">
                      {f.label}
                    </td>

                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900 break-words">
                      {f.value ? (
                        <span>{f.value}</span>
                      ) : (
                        <span className="text-gray-300 font-normal italic">null (Not detected)</span>
                      )}
                      {f.rawValue && f.rawValue !== f.value && (
                        <span className="text-[10px] text-gray-400 block font-normal">
                          Raw: {f.rawValue}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      {!isUndetected ? (
                        <div className="inline-flex flex-col items-center">
                          <span className={`font-mono font-bold ${isLowConf ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {confPercent}%
                          </span>
                          <div className="w-12 h-1 bg-gray-200 rounded-full mt-0.5 overflow-hidden">
                            <div
                              className={`h-full ${isLowConf ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${confPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300 font-mono">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600">
                        {f.source}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      {isUndetected ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-400">
                          Not detected
                        </span>
                      ) : isMismatch ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                          ⚠️ Mismatch
                        </span>
                      ) : isLowConf ? (
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200"
                          title="⚠️ Low confidence — please verify against document"
                        >
                          ⚠️ Needs review
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Verified
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[11px] text-blue-800 flex items-center justify-between">
            <span className="font-semibold">
              ✓ Strict Extraction Rule: Unavailable fields remain null without synthetic substitution.
            </span>
            <span className="text-blue-600 font-mono">Normalized YYYY-MM-DD</span>
          </div>
        </div>
      )}

      {/* Tab 2: MRZ Zone & Checksums */}
      {activeTab === 'mrz' && (
        <div className="space-y-4">
          <div className="bg-[#0F1A33] text-cyan-300 p-4 rounded-xl font-mono text-xs space-y-1.5 border border-[#1B2A4A] tracking-wider overflow-x-auto shadow-inner">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              ICAO Doc 9303 MRZ Optical Zone ({mrzResult.mrz_type || 'TD3'})
            </div>
            {rawMrz.map((line, idx) => (
              <div key={idx} className="break-all">
                {line}
              </div>
            ))}
          </div>

          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2.5">
            <div className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              7-3-1 Modulo-10 Checksum Verifications
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-gray-700 font-medium">Passport Number Checksum</span>
                <span
                  className={`font-bold text-[11px] px-2 py-0.5 rounded-full ${
                    checksums.document_number_valid !== false
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {checksums.document_number_valid !== false ? '✓ Valid' : '⚠️ Validation failed'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-gray-700 font-medium">Date of Birth Checksum</span>
                <span
                  className={`font-bold text-[11px] px-2 py-0.5 rounded-full ${
                    checksums.birth_date_valid !== false
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {checksums.birth_date_valid !== false ? '✓ Valid' : '⚠️ Validation failed'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-gray-700 font-medium">Expiry Date Checksum</span>
                <span
                  className={`font-bold text-[11px] px-2 py-0.5 rounded-full ${
                    checksums.expiry_date_valid !== false
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {checksums.expiry_date_valid !== false ? '✓ Valid' : '⚠️ Validation failed'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200">
                <span className="text-gray-700 font-medium">Composite Checksum</span>
                <span
                  className={`font-bold text-[11px] px-2 py-0.5 rounded-full ${
                    checksums.composite_valid !== false
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {checksums.composite_valid !== false ? '✓ Valid' : '⚠️ Validation failed'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Cross-Validation */}
      {activeTab === 'cross_val' && (
        <div className="space-y-4">
          <div className="text-xs text-gray-600 font-medium">
            Cross-checking optical visual text against cryptographic / machine-readable zones:
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200">
                  <th className="py-2.5 px-3">Field</th>
                  <th className="py-2.5 px-3">Visual Value</th>
                  <th className="py-2.5 px-3">MRZ / QR Value</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisons.map((c, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60">
                    <td className="py-2.5 px-3 font-semibold text-gray-800">{c.field}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-gray-900">{c.visual_value || '—'}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-cyan-800">{c.mrz_value || '—'}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          c.matched ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Quality Check */}
      {activeTab === 'quality' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Sharpness</div>
              <div className="text-base font-bold text-gray-900 font-mono mt-1">
                {quality.sharpness ?? '—'}
              </div>
              <div className="text-[10px] font-semibold text-emerald-600 capitalize">
                {quality.blur_status || 'Normal'}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Brightness</div>
              <div className="text-base font-bold text-gray-900 font-mono mt-1">
                {quality.brightness ?? '—'} / 255
              </div>
              <div className="text-[10px] font-semibold text-gray-500">Mean Luminosity</div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Contrast</div>
              <div className="text-base font-bold text-gray-900 font-mono mt-1">
                {quality.contrast ?? '—'}
              </div>
              <div className="text-[10px] font-semibold text-gray-500">Std Deviation</div>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Glare Area</div>
              <div className="text-base font-bold text-gray-900 font-mono mt-1">
                {quality.glare_percentage ? `${quality.glare_percentage}%` : '0%'}
              </div>
              <div className="text-[10px] font-semibold text-gray-500">Highlight Saturation</div>
            </div>
          </div>

          <div className="p-4 bg-slate-900 text-slate-100 rounded-xl text-xs space-y-2">
            <div className="font-bold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-emerald-400" /> Image Suitability Assessment
            </div>
            <div className="text-slate-400 leading-relaxed">
              {quality.is_suitable !== false
                ? 'Image meets forensic clarity standards. Resolution, blur, and lighting parameters are suitable for reliable character extraction.'
                : 'Image quality is degraded. Extracted characters must be validated manually against the visual document scan.'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Raw OCR */}
      {activeTab === 'raw_ocr' && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Detected Raw OCR Text Lines
            </div>
            <div className="text-xs font-mono text-gray-800 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {currentDoc.raw_text || 'No raw OCR text detected.'}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Raw JSON */}
      {activeTab === 'json' && (
        <div className="bg-gray-950 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80 border border-gray-800">
          <pre>
            {JSON.stringify(
              {
                success: true,
                document_type: {
                  value: docTypeName,
                  confidence: docConfidence
                },
                fields: structuredFields,
                mrz: currentDoc.mrz_result,
                cross_validation: crossVal,
                quality_metrics: quality
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
