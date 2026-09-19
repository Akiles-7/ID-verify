import React, { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function OcrFieldsPanel({ data }) {
  const [activeTab, setActiveTab] = useState('extracted');

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full justify-center items-center text-gray-500 text-sm">
        No OCR field data available for this document.
      </div>
    );
  }

  const fields = data;

  const fieldList = [
    { label: 'SURNAME', value: fields.surname },
    { label: 'GIVEN NAMES', value: fields.given_names },
    { label: 'PASSPORT NO.', value: fields.document_number },
    { label: 'NATIONALITY', value: fields.nationality },
    { label: 'DATE OF BIRTH', value: fields.date_of_birth },
    { label: 'SEX', value: fields.sex },
    { label: 'EXPIRY DATE', value: fields.expiry_date },
    { label: 'ISSUING COUNTRY', value: fields.issuing_country },
    { label: 'PERSONAL NO.', value: fields.personal_number },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Module Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">MODULE 1</span>
          <h3 className="text-base font-bold text-gray-900">OCR Extraction</h3>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-1">
          COMPLETE
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 mb-5">
        <button
          onClick={() => setActiveTab('extracted')}
          className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === 'extracted' ? 'border-[#2E6BE6] text-[#2E6BE6]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Extracted Fields
        </button>
        <button
          onClick={() => setActiveTab('mrz')}
          className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === 'mrz' ? 'border-[#2E6BE6] text-[#2E6BE6]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          MRZ Zone
        </button>
        <button
          onClick={() => setActiveTab('json')}
          className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 ${
            activeTab === 'json' ? 'border-[#2E6BE6] text-[#2E6BE6]' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Raw JSON
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'extracted' && (
        <div className="grid grid-cols-2 gap-4">
          {fieldList.map((f, i) => (
            <div key={i} className="bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{f.label}</div>
              <div className="text-sm font-semibold text-gray-900 font-mono">{f.value || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'mrz' && (
        <div className="bg-[#0F1A33] text-cyan-300 p-4 rounded-xl font-mono text-xs space-y-2 border border-[#1B2A4A]">
          <div>{fields.mrz_line1}</div>
          <div>{fields.mrz_line2}</div>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="bg-gray-900 text-gray-200 p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-60">
          <pre>{JSON.stringify(fields, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
