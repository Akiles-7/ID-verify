import React from 'react';
import { Terminal } from 'lucide-react';

/**
 * ProcessingConsole — Shows real logs from the AI pipeline.
 * No hardcoded fallback logs. Logs come from the actual analysis.
 */
export default function ProcessingConsole({ logs = [] }) {
  if (logs.length === 0) {
    return (
      <div className="bg-[#0F1A33] text-gray-400 rounded-xl p-4 font-mono text-xs shadow-lg border border-[#1B2A4A] mb-6 flex items-center gap-3">
        <Terminal className="w-4 h-4 text-gray-500 shrink-0" />
        <span>No processing logs available. Run a scan to see the AI pipeline output.</span>
      </div>
    );
  }

  return (
    <div className="bg-[#0F1A33] text-gray-200 rounded-xl p-4 font-mono text-xs shadow-lg border border-[#1B2A4A] mb-6 overflow-hidden max-h-52 overflow-y-auto">
      <div className="space-y-1">
        {logs.map((log, index) => (
          <div key={index} className="flex items-start gap-2">
            <span className={
              log.type === 'ERR'
                ? 'text-red-400 font-bold shrink-0'
                : log.type === 'WARN'
                ? 'text-amber-400 font-semibold shrink-0'
                : 'text-cyan-400 font-semibold shrink-0'
            }>
              [{log.type}]
            </span>
            <span className={
              log.type === 'ERR'
                ? 'text-red-300'
                : log.type === 'WARN'
                ? 'text-amber-200'
                : 'text-gray-300'
            }>
              {log.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
