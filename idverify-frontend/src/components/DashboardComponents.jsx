import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';

export function StatCard({ title, number, delta, color = 'blue', loading = false }) {
  const colorMap = {
    blue: { text: 'text-blue-600', line: 'bg-[#2E6BE6]' },
    red: { text: 'text-red-500', line: 'bg-red-500' },
    green: { text: 'text-emerald-600', line: 'bg-emerald-500' },
    amber: { text: 'text-amber-600', line: 'bg-amber-500' },
  };
  const theme = colorMap[color] || colorMap.blue;
  const barWidth = number > 0 ? Math.min(100, (number / 100) * 100) + '%' : '0%';

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between min-h-[110px]">
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
        <div className="flex items-baseline justify-between mt-2">
          {loading ? (
            <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
          ) : (
            <span className="text-3xl font-extrabold text-gray-900 font-sans tracking-tight">{number ?? '—'}</span>
          )}
          {delta != null && !loading && (
            <span className={`text-xs font-bold ${theme.text}`}>{delta >= 0 ? `+${delta}` : delta} today</span>
          )}
        </div>
      </div>
      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-4">
        <div
          className={`h-full rounded-full transition-all duration-700 ${theme.line}`}
          style={{ width: loading ? '30%' : barWidth }}
        />
      </div>
    </div>
  );
}

export function RecentCasesList({ cases, loading }) {
  const riskBadges = {
    HIGH: 'bg-red-50 text-red-600 border-red-200',
    MEDIUM: 'bg-amber-50 text-amber-600 border-amber-200',
    LOW: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">Recent Cases</h3>
          <p className="text-xs text-gray-400">Last 6 scans processed</p>
        </div>
        <Link to="/cases" className="text-xs font-bold text-[#2E6BE6] hover:underline">
          View all →
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-gray-100 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : cases && cases.length > 0 ? (
        <div className="space-y-1">
          {cases.map((item) => (
            <Link
              key={item.id}
              to={`/scan/${item.id}`}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2E6BE6] flex items-center justify-center font-bold text-xs uppercase">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 tracking-wide">{item.subjectName}</div>
                  <div className="text-xs text-gray-400 font-mono">{item.caseCode} · {item.timeAgo || ''}</div>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${riskBadges[item.riskBand] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                {item.riskBand}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-gray-400">
          <FileText className="w-8 h-8 mb-2 opacity-40" />
          <p className="text-sm font-semibold">No recent cases</p>
          <p className="text-xs mt-1">Processed scans will appear here.</p>
        </div>
      )}
    </div>
  );
}

export function SystemStatusList({ health, loading }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">System Status</h3>
        <p className="text-xs text-gray-400">AI module health</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="h-3 w-36 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : health && health.length > 0 ? (
        <div className="space-y-3">
          {health.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/40" />
                <span className="font-semibold text-gray-800">{item.module || item.modelName}</span>
              </div>
              <span className="font-mono text-gray-400">{item.latencyMs != null ? `${item.latencyMs}ms` : item.latency || '—'}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-6 h-6 mb-2 animate-spin opacity-40" />
          <p className="text-xs font-semibold">Health data unavailable</p>
        </div>
      )}
    </div>
  );
}
