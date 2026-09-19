import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, BarChart3, Cpu, Download, AlertCircle } from 'lucide-react';
import MainLayout, { TopBar } from '../layout/MainLayout';
import { StatCard, RecentCasesList, SystemStatusList } from '../components/DashboardComponents';
import api from '../services/api';

/* ─────────────────────── Inline Analytics Components ─────────────────────── */

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#2E6BE6]" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function ScansByHourChart({ data }) {
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm h-full">
      <SectionHeader icon={TrendingUp} title="Scans by Hour" subtitle="Today's scan volume distribution" />
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm font-semibold">No hourly data yet</p>
        <p className="text-xs text-gray-400 mt-1">Scans will appear as they are processed today</p>
      </div>
    </div>
  );

  const maxCount = Math.max(...data.map(d => d.count || 0), 1);
  const totalScans = data.reduce((s, d) => s + (d.count || 0), 0);

  // Clean time labels: show only every 4th hour in 12h format
  const formatHour = (hour) => {
    const h = parseInt(hour, 10);
    if (isNaN(h)) return '';
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm overflow-hidden min-w-0">
      <SectionHeader icon={TrendingUp} title="Scans by Hour" subtitle={`Today's distribution · ${totalScans} total scans`} />

      {/* Chart area */}
      <div className="relative">
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none" style={{ height: '140px' }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="w-full border-b border-dashed border-gray-100" />
          ))}
        </div>

        {/* Bars */}
        <div className="flex items-end gap-[2px] relative" style={{ height: '140px' }}>
          {data.map((d, i) => {
            const hasData = (d.count || 0) > 0;
            const pct = hasData ? Math.max(8, Math.round((d.count / maxCount) * 100)) : 0;
            const barHeight = hasData ? Math.min(pct * 1.3, 130) : 0;

            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end group relative" style={{ height: '140px' }}>
                {/* Tooltip - top layer, no clipping */}
                {hasData && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1.5 bg-slate-800 text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-lg"
                       style={{ zIndex: 50 }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {d.count} scan{d.count !== 1 ? 's' : ''} · {formatHour(d.hour)}
                  </div>
                )}

                {hasData ? (
                  /* Active bar — gradient deep slate-blue, rounded top */
                  <div
                    className="w-full rounded-t cursor-pointer transition-all duration-500 hover:opacity-80"
                    style={{
                      height: `${barHeight}px`,
                      borderRadius: '4px 4px 0 0',
                      background: 'linear-gradient(180deg, #3B82F6 0%, #1E40AF 100%)',
                    }}
                  />
                ) : (
                  /* Empty hour — subtle dot indicator instead of tall empty bar */
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-200 mb-0.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Single clean X-axis labels — every 4th hour in 12h format */}
        <div className="flex mt-2">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              {i % 4 === 0 ? (
                <span className="text-[9px] text-gray-400 font-medium">{formatHour(d.hour)}</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RiskDistributionBars({ data }) {
  if (!data || data.length === 0) return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm h-full">
      <SectionHeader icon={BarChart3} title="Risk Distribution" subtitle="Scan outcome breakdown" />
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm font-semibold">No distribution data yet</p>
        <p className="text-xs text-gray-400 mt-1">Risk bands will populate once scans are completed</p>
      </div>
    </div>
  );

  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  const colorMap = {
    HIGH:   { bar: 'bg-red-500',     badge: 'bg-red-50 text-red-600 border-red-200',       dot: 'bg-red-500' },
    MEDIUM: { bar: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-600 border-amber-200', dot: 'bg-amber-500' },
    LOW:    { bar: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500' },
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm overflow-hidden min-w-0">
      <SectionHeader icon={BarChart3} title="Risk Distribution" subtitle={`${total} total scans processed`} />
      <div className="space-y-4">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
          const colors = colorMap[d.band] || { bar: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' };
          return (
            <div key={i}>
              <div className="flex items-center justify-between mb-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className={`px-2.5 py-0.5 rounded-full font-bold border ${colors.badge}`}>{d.band}</span>
                </div>
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
      <SectionHeader icon={Cpu} title="Module Performance" subtitle="AI pipeline latency and accuracy per module" />
      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
        <Cpu className="w-10 h-10 mb-2 opacity-30" />
        <p className="text-sm font-semibold">No module performance data</p>
        <p className="text-xs mt-1">Module stats populate once the AI pipeline runs scans</p>
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

/* ─────────────────────────── Main Dashboard Page ─────────────────────────── */

export default function Dashboard() {
  const navigate = useNavigate();

  // Overview stats
  const [stats, setStats]             = useState(null);
  const [recentCases, setRecentCases] = useState([]);
  const [moduleHealth, setModuleHealth] = useState([]);

  // Analytics
  const [hourlyData, setHourlyData]   = useState(null);
  const [riskData, setRiskData]       = useState(null);
  const [perfData, setPerfData]       = useState(null);

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, casesRes, healthRes, hourlyRes, riskRes, perfRes] = await Promise.all([
          api.get('/dashboard/overview'),
          api.get('/dashboard/recent-cases?limit=6'),
          api.get('/dashboard/module-health'),
          api.get('/reports/scans-by-hour').catch(() => ({ data: [] })),
          api.get('/reports/risk-distribution').catch(() => ({ data: [] })),
          api.get('/reports/module-performance').catch(() => ({ data: [] })),
        ]);
        setStats(statsRes.data);
        setRecentCases(casesRes.data || []);
        setModuleHealth(healthRes.data || []);
        setHourlyData(hourlyRes.data);
        setRiskData(riskRes.data);
        setPerfData(perfRes.data);
      } catch (err) {
        setError('Unable to reach server. Please ensure the backend is running.');
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
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
        title="Dashboard & Analytics"
        subtitle={`${today} · Port Authority Terminal 3`}
        actionButton={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2.5 rounded-xl bg-white/20 border border-white/30 text-white text-xs font-bold hover:bg-white/30 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
            <button
              id="btn-new-scan"
              onClick={() => navigate('/scan/new')}
              className="px-5 py-2.5 rounded-xl bg-white text-[#2563EB] text-xs font-bold hover:bg-blue-50 active:scale-95 transition-all shadow-md flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Scan</span>
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500" />
          {error}
        </div>
      )}

      {/* ── Top 4 Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Scans Today"     number={stats?.scansToday ?? null}      delta={stats?.scansTodayDelta} color="blue"  loading={loading} />
        <StatCard title="High Risk Flagged" number={stats?.highRiskFlagged ?? null} delta={stats?.highRiskDelta}  color="red"   loading={loading} />
        <StatCard title="Cleared"         number={stats?.cleared ?? null}          delta={stats?.clearedDelta}    color="green" loading={loading} />
        <StatCard title="Pending Review"  number={stats?.pendingReview ?? null}    delta={stats?.pendingDelta}    color="amber" loading={loading} />
      </div>

      {/* ── Recent Cases + System Status ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <RecentCasesList cases={recentCases} loading={loading} />
        </div>
        <div>
          <SystemStatusList health={moduleHealth} loading={loading} />
        </div>
      </div>

      {/* ── Analytics Section Divider ── */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Analytics & Reports</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* ── Scans by Hour + Risk Distribution ── */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1].map(i => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-6" />
                <div className="flex items-end gap-2 h-36">
                  {[...Array(8)].map((_, j) => (
                    <div key={j} className="flex-1 bg-gray-100 rounded-t" style={{ height: `${30 + Math.random() * 60}%` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/4 mb-6" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
            </div>
          </div>
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
