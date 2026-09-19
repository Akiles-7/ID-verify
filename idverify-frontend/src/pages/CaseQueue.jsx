import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Search, FileText, Loader2, AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';
import MainLayout, { TopBar } from '../layout/MainLayout';
import PermissionDeniedModal from '../components/PermissionDeniedModal';
import api from '../services/api';

const riskBadges = {
  HIGH: 'bg-red-50 text-red-600 border-red-200',
  MEDIUM: 'bg-amber-50 text-amber-600 border-amber-200',
  LOW: 'bg-emerald-50 text-emerald-600 border-emerald-200',
};

const statusBadges = {
  FLAGGED: 'bg-red-50 text-red-600 border-red-200',
  PENDING: 'bg-amber-50 text-amber-600 border-amber-200',
  CLEARED: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  PROCESSING: 'bg-blue-50 text-blue-600 border-blue-200',
};

export default function CaseQueue() {
  const user = useSelector((state) => state.auth?.user);
  const isAdmin = user?.role === 'ROLE_ADMIN' || user?.role === 'ADMIN' || user?.username === 'admin';
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const handleDeleteCase = async (e, id, caseCode, subjectName) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to permanently delete case ${caseCode} (${subjectName}) from the database? This will delete all associated OCR, validation, tampering, face, and risk records across the system.`)) {
      return;
    }

    try {
      setDeletingId(id);
      await api.delete(`/cases/${id}`);
      setCases((prev) => prev.filter((item) => item.id !== id));
      setDeleteMessage(`Case ${caseCode} deleted permanently from database.`);
      setTimeout(() => setDeleteMessage(null), 4000);
    } catch (err) {
      alert(`Failed to delete case: ${err.response?.data?.message || err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const fetchCases = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/cases?filter=${filter}&search=${encodeURIComponent(search)}&page=${page}&size=10`);
      const data = res.data;
      if (data?.content != null) {
        setCases(data.content);
        setTotalPages(data.totalPages || 1);
      } else if (Array.isArray(data)) {
        setCases(data);
      } else {
        setCases([]);
      }
    } catch (err) {
      setError('Failed to load cases. Please ensure the backend server is running.');
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [filter, search, page]);

  useEffect(() => {
    const debounce = setTimeout(fetchCases, 300);
    return () => clearTimeout(debounce);
  }, [fetchCases]);

  if (!isAdmin) {
    return (
      <MainLayout>
        <TopBar title="Case Queue" subtitle="Access restricted" />
        <PermissionDeniedModal />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <TopBar title="Case Queue" subtitle="All scanned documents requiring officer review" />

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            id="case-search"
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name or case ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl text-xs font-semibold">
          {['ALL', 'FLAGGED', 'PENDING', 'CLEARED'].map((t) => (
            <button
              key={t}
              id={`filter-${t.toLowerCase()}`}
              onClick={() => { setFilter(t); setPage(0); }}
              className={`px-4 py-1.5 rounded-lg transition-colors ${
                filter === t ? 'bg-[#2E6BE6] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Success Notification Banner */}
      {deleteMessage && (
        <div className="mb-4 flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{deleteMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Case List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                </div>
                <div className="h-6 w-20 bg-gray-100 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : cases.length > 0 ? (
        <>
          <div className="space-y-3">
            {cases.map((c) => (
              <Link
                key={c.id}
                to={`/scan/${c.id}`}
                className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between group relative"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2E6BE6] flex items-center justify-center shadow-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-400 font-mono">
                      {c.caseCode} · {c.documentType}
                    </div>
                    <div className="text-base font-bold text-gray-900 font-sans tracking-wide group-hover:text-[#2E6BE6] transition-colors">
                      {c.subjectName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <span className="text-lg font-extrabold text-gray-900 font-mono">{c.riskScore}</span>
                    <span className="text-xs text-gray-400 font-mono"> /100</span>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${riskBadges[c.riskBand] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {c.riskBand}
                  </span>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusBadges[c.status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    {c.status}
                  </span>

                  <span className="text-xs font-mono text-gray-400 w-12 text-right hidden md:block">
                    {c.timeAgo || c.time || ''}
                  </span>

                  {isAdmin && (
                    <button
                      type="button"
                      disabled={deletingId === c.id}
                      onClick={(e) => handleDeleteCase(e, c.id, c.caseCode, c.subjectName)}
                      title={`Delete case ${c.caseCode} (Admin only)`}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors z-20 disabled:opacity-40"
                    >
                      {deletingId === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500 font-semibold">Page {page + 1} of {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl p-16 border border-gray-200 shadow-sm flex flex-col items-center text-gray-400">
          <FileText className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-base font-bold text-gray-600">No cases found in database</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm text-center">
            {search ? `No results for "${search}"` : 'Database is currently empty. Upload a new document to begin scanning, or load sample demo cases.'}
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link to="/scan/new" className="px-5 py-2.5 rounded-xl bg-[#2E6BE6] text-white font-bold text-xs hover:bg-blue-700 shadow-md shadow-blue-500/20">
              + New Scan
            </Link>
            <button
              onClick={async () => {
                try {
                  await api.post('/demo/seed');
                  fetchCases();
                } catch {
                  alert('Demo seed requested');
                }
              }}
              className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs hover:bg-gray-200"
            >
              Load Sample Demo Cases
            </button>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
