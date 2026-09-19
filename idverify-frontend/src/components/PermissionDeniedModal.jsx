import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PermissionDeniedModal({ onDismiss }) {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onDismiss) onDismiss();
          navigate('/', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, onDismiss]);

  const handleReturn = () => {
    if (onDismiss) onDismiss();
    navigate('/', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center transform transition-all">
        {/* Permission Denied Artwork Image */}
        <div className="w-full flex justify-center mb-2 overflow-hidden rounded-2xl">
          <img
            src="/permission-denied.png"
            alt="Permission Denied"
            className="w-full max-h-56 object-contain"
          />
        </div>

        <h2 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
          Permission Denied
        </h2>

        <p className="text-xs text-gray-600 font-medium leading-relaxed mb-4 px-2">
          You are not allowed to access the <span className="font-bold text-gray-900">Case Queue</span>.
          Only system administrators have permission to review, clear, and delete cases.
        </p>

        <div className="text-[11px] font-mono text-gray-400 mb-6 flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Redirecting to Dashboard in {countdown}s...</span>
        </div>

        <button
          onClick={handleReturn}
          className="w-full py-3 rounded-xl bg-[#2E6BE6] text-white text-xs font-bold hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard Now</span>
        </button>
      </div>
    </div>
  );
}
