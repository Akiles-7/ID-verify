import React from 'react';

export function ScansByHourChart({ data }) {
  const chartData = Array.isArray(data) ? data : [];

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm text-center text-gray-500 text-sm">
        No hourly scan data available.
      </div>
    );
  }

  const maxScans = Math.max(1, ...chartData.map(d => (d.Cleared || 0) + (d.Flagged || 0)));

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Scans by Hour</h3>
        <p className="text-xs text-gray-400">Today</p>
      </div>

      <div className="h-48 flex items-end gap-3 pt-6 pb-2 border-b border-gray-100">
        {chartData.map((d, idx) => {
          const cleared = d.Cleared || 0;
          const flagged = d.Flagged || 0;
          const total = cleared + flagged;
          const heightPct = Math.round((total / maxScans) * 100);

          return (
            <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
              <div className="w-full flex flex-col justify-end max-w-[40px]" style={{ height: `${heightPct}%` }}>
                {flagged > 0 && (
                  <div
                    className="w-full bg-red-500 rounded-t-sm"
                    style={{ height: `${Math.round((flagged / total) * 100)}%` }}
                    title={`Flagged: ${flagged}`}
                  />
                )}
                {cleared > 0 && (
                  <div
                    className={`w-full bg-[#2E6BE6] ${flagged === 0 ? 'rounded-t-sm' : ''}`}
                    style={{ height: `${Math.round((cleared / total) * 100)}%` }}
                    title={`Cleared: ${cleared}`}
                  />
                )}
              </div>
              <span className="text-[10px] font-mono text-gray-500 mt-2">{d.hour}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RiskDistributionBars({ data }) {
  const docs = Array.isArray(data) ? data : [];

  if (docs.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm text-center text-gray-500 text-sm">
        No risk distribution data available.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Risk Distribution</h3>
        <p className="text-xs text-gray-400">By document type</p>
      </div>

      <div className="space-y-4">
        {docs.map((doc, idx) => (
          <div key={idx}>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-gray-800">{doc.name || doc.documentType}</span>
              <span className="text-gray-400 font-mono">{doc.total || 0} scans</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-gray-100">
              <div className="bg-red-500 h-full" style={{ width: `${doc.high || 0}%` }} />
              <div className="bg-amber-500 h-full" style={{ width: `${doc.med || 0}%` }} />
              <div className="bg-emerald-500 h-full" style={{ width: `${doc.low || 0}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs font-semibold text-gray-500 mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Low</span>
        </div>
      </div>
    </div>
  );
}

export function ModulePerformanceCard({ data }) {
  const modules = Array.isArray(data) ? data : [];

  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mt-6 text-center text-gray-500 text-sm">
        No module performance metrics available.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mt-6">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Module Performance</h3>
        <p className="text-xs text-gray-400">Average processing time per module</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {modules.map((m, idx) => (
          <div key={idx} className="bg-gray-50/70 p-4 rounded-xl border border-gray-100">
            <div className="text-xs font-bold text-gray-800 mb-1">{m.title || m.module_name}</div>
            <div className="text-2xl font-extrabold text-[#2E6BE6] font-mono tracking-tight">{m.time || m.latency}</div>
            <div className="text-[11px] text-gray-400 font-mono mt-1">Status: {m.status || 'OK'}</div>
            <div className="text-[10px] text-gray-500 font-mono mt-3 truncate">{m.engine || m.model_name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

