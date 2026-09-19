import React, { useEffect, useState } from 'react';
import MainLayout, { TopBar } from '../layout/MainLayout';
import { BarChart3, Download, AlertCircle, Loader2, TrendingUp, Clock, Cpu } from 'lucide-react';
import api from '../services/api';

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#2E6BE6]" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-100 rounded w-1/3 mb-6" />
      <div className="flex items-end gap-2 h-36">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${30 + Math.random() * 60}%` }} />
        ))}
      </div>
    </div>
  );
}

function ScansByHourChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <SectionHeader icon={TrendingUp} title="Scans by Hour" subtitle="Today's scan volume distribution" />
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm font-semibold">No hourly data yet</p>
      </div>
    </div>
  );

  const maxCount = Math.max(...data.map(d => d.count || 0), 1);

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <SectionHeader icon={TrendingUp} title="Scans by Hour" subtitle="Today's scan volume distribution" />
      <div className="flex items-end gap-1.5 h-40">
        {data.map((d, i) => {
          const pct = Math.max(4, Math.round((d.count / maxCount) * 100));
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex justify-center">
                <div
                  title={`${d.hour}: ${d.count} scans`}
                  className="w-full bg-[#2E6BE6] rounded-t-lg transition-all duration-500 hover:bg-blue-700 cursor-pointer relative"
                  style={{ height: `${pct * 1.3}px` }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10">
                    {d.count} scans
                  </div>
                </div>
              </div>
              <span className="text-[9px] text-gray-400 font-mono">{d.hour}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-2 font-mono">
        <span>00:00</span>
        <span>Total: {data.reduce((s, d) => s + (d.count || 0), 0)} scans</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

function RiskDistributionBars({ data }) {
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <SectionHeader icon={BarChart3} title="Risk Distribution" subtitle="Scan outcome breakdown" />
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm font-semibold">No distribution data yet</p>
      </div>
    </div>
  );

  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  const colorMap = {
    HIGH: { bar: 'bg-red-500', badge: 'bg-red-50 text-red-600 border-red-200' },
    MEDIUM: { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
    LOW: { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <SectionHeader icon={BarChart3} title="Risk Distribution" subtitle={`${total} total scans processed`} />
      <div className="space-y-4">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          const colors = colorMap[d.band] || { bar: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200' };
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className={`px-2.5 py-0.5 rounded-full font-bold border ${colors.badge}`}>{d.band}</span>
                <div className="flex items-center gap-3 text-gray-500">
                  <span className="font-mono font-bold text-gray-900">{d.count}</span>
                  <span>({pct}%)</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${colors.bar} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModulePerformanceCard({ data }) {
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <SectionHeader icon={Cpu} title="Module Performance" subtitle="AI pipeline latency and accuracy" />
      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
        <Cpu className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm font-semibold">No module performance data</p>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <SectionHeader icon={Cpu} title="Module Performance" subtitle="AI pipeline latency and accuracy per module" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left font-bold text-gray-500 uppercase tracking-wider pb-3 pr-4">Module</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wider pb-3 px-4">Avg Latency</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wider pb-3 px-4">Scans Processed</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wider pb-3 px-4">Accuracy</th>
              <th className="text-right font-bold text-gray-500 uppercase tracking-wider pb-3 pl-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((m, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 pr-4">
                  <span className="font-semibold text-gray-900">{m.module || m.moduleName}</span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-gray-700">
                  {m.avgLatencyMs != null ? `${m.avgLatencyMs}ms` : '—'}
                </td>
                <td className="py-3 px-4 text-right font-bold text-gray-900">
                  {m.scansProcessed ?? m.count ?? '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  {m.accuracyPct != null ? (
                    <span className={`font-bold ${m.accuracyPct >= 90 ? 'text-emerald-600' : m.accuracyPct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                      {m.accuracyPct}%
                    </span>
                  ) : '—'}
                </td>
                <td className="py-3 pl-4 text-right">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {m.status || 'HEALTHY'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Reports() {
  const [hourlyData, setHourlyData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [perfData, setPerfData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      setError(null);
      try {
        const [hourlyRes, riskRes, perfRes] = await Promise.all([
          api.get('/reports/scans-by-hour'),
          api.get('/reports/risk-distribution'),
          api.get('/reports/module-performance'),
        ]);
        setHourlyData(hourlyRes.data);
        setRiskData(riskRes.data);
        setPerfData(perfRes.data);
      } catch (err) {
        setError('Unable to load report data. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  const handleExport = async () => {
    try {
      const res = await api.get('/reports/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IDVerify_Report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      alert('Export feature requires backend running. Please try again after server startup.');
    }
  };

  return (
    <MainLayout>
      <TopBar
        title="Reports & Analytics"
        subtitle={`${today} · Current shift overview`}
        actionButton={
          <button
            id="btn-export-report"
            onClick={handleExport}
            className="px-4 py-2.5 rounded-xl bg-white text-[#2563EB] text-xs font-bold hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-md"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoadingCard />
            <LoadingCard />
          </div>
          <LoadingCard />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScansByHourChart data={hourlyData} />
            <RiskDistributionBars data={riskData} />
          </div>
          <ModulePerformanceCard data={perfData} />
        </div>
      )}
    </MainLayout>
  );
}
