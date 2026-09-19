import React, { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import MainLayout, { TopBar } from '../layout/MainLayout';
import StepByStepScan from '../components/StepByStepScan';
import api from '../services/api';
import { Trash2, AlertTriangle, X } from 'lucide-react';

export default function ScanResults() {
  const { caseId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [scanData, setScanData] = useState(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);


  useEffect(() => {
    if (location.state?.docPreviewUrl) {
      setDocPreviewUrl(location.state.docPreviewUrl);
    }
    if (location.state?.livePreviewUrl) {
      setLivePreviewUrl(location.state.livePreviewUrl);
    }

    // Priority 1: pre-computed results passed via router state
    if (location.state?.scanResult) {
      setScanData(location.state.scanResult);
      setLoading(false);
      return;
    }

    // Priority 2: fetch from Spring Boot backend (real AI result from DB)
    if (caseId && caseId !== 'result') {
      async function fetchScanResult() {
        try {
          const res = await api.get(`/scan/${caseId}/result`);
          setScanData(res.data);
        } catch (err) {
          setError(`Could not load case ${caseId}. ${err.response?.data?.message || ''}`);
        } finally {
          setLoading(false);
        }
      }
      fetchScanResult();
    } else {
      setError('No scan result available. Please run a new scan.');
      setLoading(false);
    }
  }, [caseId, location.state]);

  const subjectName = scanData?.ocr?.surname && scanData?.ocr?.surname !== 'NO_IMAGE' && scanData?.ocr?.surname !== 'OCR_FAILED'
    ? `${scanData.ocr.surname}, ${scanData.ocr.given_names || ''}`.trim()
    : scanData?.subjectName || 'Awaiting OCR';

  const caseCode = scanData?.caseCode || (caseId && caseId !== 'result' ? `CASE-${caseId}` : 'NEW-SCAN');

  const handleDeleteDocument = async () => {
    try {
      setDeleting(true);
      const targetId = caseId && caseId !== 'result' ? caseId : scanData?.id;
      if (targetId) {
        await api.delete(`/cases/${targetId}`);
      }
      setShowDeleteModal(false);
      navigate('/scan', { replace: true });
    } catch (err) {
      console.error('Delete document error:', err);
      alert('Failed to delete document from database.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout>
      <TopBar
        title={`Scan — ${caseCode}`}
        subtitle={`Subject: ${subjectName} · Type: ${location.state?.documentType || scanData?.documentType || 'DOCUMENT'}`}
      />

      {/* Action Strip with Delete Document button */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="text-xs text-gray-500">
          Showing forensic extraction and layout analysis for <strong className="text-gray-800">{caseCode}</strong>
        </div>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-3.5 py-1.5 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Document</span>
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-[#2E6BE6] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Loading scan results…</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700 text-sm max-w-2xl">
          <div className="font-bold mb-1">Error Loading Results</div>
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && (
        <StepByStepScan
          scanData={scanData}
          caseId={caseId && caseId !== 'result' ? caseId : null}
          docPreviewUrl={docPreviewUrl}
          livePreviewUrl={livePreviewUrl}
          onActionComplete={(status) => {
            setScanData((prev) => (prev ? { ...prev, status } : null));
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-gray-900">Permanently Delete Document?</h3>
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                  This action satisfies identity privacy compliance and will permanently delete the uploaded document scan, OCR text, and risk assessment records from the database and disk storage.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
              >
                {deleting ? (
                  <span>Deleting…</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
