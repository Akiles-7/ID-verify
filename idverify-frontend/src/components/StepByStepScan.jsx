import React, { useState } from 'react';
import OcrFieldsPanel from './OcrFieldsPanel';
import DocumentBoundingBoxViewer from './DocumentBoundingBoxViewer';
import ValidationChecklist from './ValidationChecklist';
import TamperHeatmap from './TamperHeatmap';
import FaceCompareCard from './FaceCompareCard';
import RiskAssessmentPanel from './RiskAssessmentPanel';
import ProcessingConsole from './ProcessingConsole';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';

export default function StepByStepScan({ scanData, caseId, docPreviewUrl, livePreviewUrl, onActionComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showFullPage, setShowFullPage] = useState(false);
  const [highlightedField, setHighlightedField] = useState(null);
  const [localScanData, setLocalScanData] = useState(scanData);

  useEffect(() => {
    setLocalScanData(scanData);
  }, [scanData]);

  const handleVerificationUpdated = (updateData) => {
    setLocalScanData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        face: updateData.face || prev.face,
        liveness: updateData.liveness || prev.liveness,
      };
    });
  };

  const steps = [
    { num: 1, title: 'Module 1: OCR Extraction', desc: 'Identity fields & ICAO 9303 MRZ parsing' },
    { num: 2, title: 'Module 2: Document Validation', desc: '7-3-1 modulo-10 checksums & format rules' },
    { num: 3, title: 'Module 3: Tampering Detection', desc: 'ELA heatmap overlay & EXIF metadata' },
    { num: 4, title: 'Module 4: Face & Liveness', desc: 'ArcFace 512-D face match & passive liveness' },
    { num: 5, title: 'Module 5: Risk Scoring Engine', desc: 'Weighted score verdict & officer actions' },
  ];

  // Real logs from AI pipeline — passed through from the API response
  const logs = scanData?.logs || [];
  const resolvedCaseId = caseId || scanData?.caseId || scanData?.id;

  const handleNextStep = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowFullPage(true);
    }
  };

  if (!scanData) {
    return (
      <div className="bg-white rounded-2xl p-12 border border-gray-200 shadow-sm text-center">
        <div className="w-12 h-12 border-2 border-gray-300 border-t-[#2E6BE6] rounded-full animate-spin mx-auto mb-4" />
        <div className="text-gray-500 text-sm font-semibold">Waiting for scan results…</div>
        <div className="text-xs text-gray-400 mt-1">The AI pipeline is processing your document</div>
      </div>
    );
  }

  if (showFullPage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <div>
              <div className="text-xs font-bold text-blue-900">5-Module Pipeline Execution Complete</div>
              <div className="text-xs text-blue-700">All results are from real AI analysis of your uploaded document.</div>
            </div>
          </div>
          <button
            onClick={() => { setShowFullPage(false); setCurrentStep(1); }}
            className="px-3 py-1.5 rounded-xl bg-white text-blue-600 border border-blue-300 text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-run Step Wizard
          </button>
        </div>

        <ProcessingConsole logs={logs} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DocumentBoundingBoxViewer
            imageUrl={docPreviewUrl || scanData?.documentImagePath}
            blocks={scanData?.ocr?.raw_blocks || []}
            highlightField={highlightedField}
            qualityMetrics={scanData?.ocr?.quality_metrics}
          />
          <OcrFieldsPanel data={scanData?.ocr} onHoverField={setHighlightedField} />
          <ValidationChecklist data={scanData?.validation} />
          <TamperHeatmap data={scanData?.tampering || scanData?.tamper} />
          <FaceCompareCard
            data={localScanData?.face}
            livenessData={localScanData?.liveness}
            docImageUrl={localScanData?.face?.doc_face_b64 || localScanData?.ocr?.doc_face_b64 || localScanData?.ocr?.face_crop_b64 || docPreviewUrl}
            liveImageUrl={localScanData?.face?.live_face_b64 || livePreviewUrl}
            caseId={resolvedCaseId}
            onVerificationUpdated={handleVerificationUpdated}
          />
        </div>

        <RiskAssessmentPanel data={localScanData?.risk} caseId={resolvedCaseId} onActionComplete={onActionComplete} fullScanData={localScanData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wizard Progress Bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            STEP-BY-STEP PIPELINE EXECUTION ({currentStep} OF 5)
          </div>
          <button
            onClick={() => setShowFullPage(true)}
            className="text-xs font-bold text-[#2E6BE6] hover:underline"
          >
            Skip to Full Overview →
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {steps.map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`p-3 rounded-xl border text-left transition-all ${
                currentStep === s.num
                  ? 'bg-[#2E6BE6] text-white border-[#2E6BE6] shadow-md'
                  : currentStep > s.num
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-extrabold mb-1">
                <span>STEP {s.num}</span>
                {currentStep > s.num && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
              <div className="text-xs font-bold truncate">{s.title.split(': ')[1]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Logs from AI Pipeline */}
      <ProcessingConsole logs={logs} />

      {/* Step Content */}
      <div className="min-h-[420px]">
        {currentStep === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DocumentBoundingBoxViewer
              imageUrl={docPreviewUrl || scanData?.documentImagePath}
              blocks={scanData?.ocr?.raw_blocks || []}
              highlightField={highlightedField}
              qualityMetrics={scanData?.ocr?.quality_metrics}
            />
            <OcrFieldsPanel data={scanData?.ocr} onHoverField={setHighlightedField} />
          </div>
        )}
        {currentStep === 2 && <ValidationChecklist data={scanData?.validation} />}
        {currentStep === 3 && <TamperHeatmap data={scanData?.tampering || scanData?.tamper} />}
        {currentStep === 4 && (
          <FaceCompareCard
            data={localScanData?.face}
            livenessData={localScanData?.liveness}
            docImageUrl={localScanData?.face?.doc_face_b64 || localScanData?.ocr?.doc_face_b64 || localScanData?.ocr?.face_crop_b64 || docPreviewUrl}
            liveImageUrl={localScanData?.face?.live_face_b64 || livePreviewUrl}
            caseId={resolvedCaseId}
            onVerificationUpdated={handleVerificationUpdated}
          />
        )}
        {currentStep === 5 && (
          <RiskAssessmentPanel data={localScanData?.risk} caseId={resolvedCaseId} onActionComplete={onActionComplete} fullScanData={localScanData} />
        )}
      </div>

      {/* Step Control Action Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <button
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 rounded-xl text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          ← Previous Step
        </button>

        <div className="text-xs text-gray-500 font-semibold">
          {steps[currentStep - 1].desc}
        </div>

        <button
          onClick={handleNextStep}
          className="px-5 py-2.5 rounded-xl bg-[#2E6BE6] text-white text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-md shadow-blue-500/20"
        >
          <span>{currentStep === 5 ? 'Finish & Show Full Page' : 'Next Step'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
