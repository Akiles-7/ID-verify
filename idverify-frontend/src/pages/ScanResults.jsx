import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import MainLayout, { TopBar } from '../layout/MainLayout';
import StepByStepScan from '../components/StepByStepScan';
import api from '../services/api';

export default function ScanResults() {
  const { caseId } = useParams();
  const location = useLocation();
  const [scanData, setScanData] = useState(null);
  const [docPreviewUrl, setDocPreviewUrl] = useState(null);
  const [livePreviewUrl, setLivePreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  return (
    <MainLayout>
      <TopBar
        title={`Scan — ${caseCode}`}
        subtitle={`Subject: ${subjectName} · Type: ${location.state?.documentType || scanData?.documentType || 'DOCUMENT'}`}
      />

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
    </MainLayout>
  );
}
