import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

export default function ValidationChecklist({ data }) {
  const [filter, setFilter] = useState('All');

  if (!data || !Array.isArray(data.checks)) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full justify-center items-center text-gray-500 text-sm">
        No validation checks data available for this document.
      </div>
    );
  }

  const checks = data.checks;
  const passCount = data.passCount ?? checks.filter(c => c.passed).length;
  const failCount = data.failCount ?? (checks.length - passCount);

  const filteredChecks = checks.filter((c) => {
    if (filter === 'Fail') return !c.passed;
    if (filter === 'Pass') return c.passed;
    return true;
  });

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Module Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">MODULE 2</span>
          <h3 className="text-base font-bold text-gray-900">Document Validation</h3>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">
          COMPLETE
        </span>
      </div>

      {/* Summary Stats + Filter Tabs */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <div className="text-xs font-bold space-x-2">
          <span className="text-emerald-600">{passCount} PASS</span>
          <span className="text-gray-300">·</span>
          <span className="text-red-600">{failCount} FAIL</span>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-semibold">
          {['All', 'Fail', 'Pass'].map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                filter === t ? 'bg-[#2E6BE6] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Checks List */}
      <div className="space-y-3 overflow-y-auto max-h-[340px] pr-1">
        {filteredChecks.map((check, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl border flex items-start gap-3 transition-colors ${
              check.passed ? 'bg-gray-50/70 border-gray-100' : 'bg-red-50/70 border-red-200'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                check.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'
              }`}
            >
              {check.passed ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-gray-900">{check.checkName}</div>
              <div className={`text-[11px] font-mono mt-0.5 ${check.passed ? 'text-gray-500' : 'text-red-600 font-semibold'}`}>
                {check.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
