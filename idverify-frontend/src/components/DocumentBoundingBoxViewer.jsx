import React, { useState, useRef } from 'react';
import { Eye, EyeOff, Layers, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function DocumentBoundingBoxViewer({
  imageUrl,
  blocks = [],
  highlightField = null,
  qualityMetrics = null
}) {
  const [overlayMode, setOverlayMode] = useState('fields'); // 'fields', 'all', 'none'
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  if (!imageUrl) {
    return (
      <div className="bg-gray-100 rounded-2xl h-80 flex items-center justify-center text-gray-400 text-xs font-semibold">
        No document image available
      </div>
    );
  }

  // Calculate image natural dimensions if available in quality metrics
  const imgWidth = qualityMetrics?.width || 800;
  const imgHeight = qualityMetrics?.height || 600;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-600" />
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Document Visual Inspector
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg text-[11px] font-semibold">
            <button
              onClick={() => setOverlayMode('fields')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                overlayMode === 'fields'
                  ? 'bg-white text-[#2E6BE6] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Key Fields
            </button>
            <button
              onClick={() => setOverlayMode('all')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                overlayMode === 'all'
                  ? 'bg-white text-[#2E6BE6] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All Text ({blocks?.length || 0})
            </button>
            <button
              onClick={() => setOverlayMode('none')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                overlayMode === 'none'
                  ? 'bg-white text-gray-800 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Image Only
            </button>
          </div>

          <div className="h-4 w-px bg-gray-300 mx-1" />

          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.75, z - 0.25))}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Image Preview Canvas */}
      <div
        ref={containerRef}
        className="relative bg-gray-950 flex items-center justify-center overflow-auto max-h-[460px] min-h-[320px] p-4 select-none"
      >
        <div
          className="relative inline-block transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          <img
            src={imageUrl}
            alt="Uploaded Document"
            className="max-h-[420px] w-auto rounded-lg shadow-2xl block object-contain"
          />

          {/* Bounding Box SVG Layer */}
          {overlayMode !== 'none' && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${imgWidth} ${imgHeight}`}
              preserveAspectRatio="none"
            >
              {blocks.map((block, idx) => {
                if (!block.bbox || block.bbox.length < 4) return null;
                const [bx, by, bw, bh] = block.bbox;
                const isHighlighted =
                  highlightField &&
                  block.text &&
                  highlightField.toLowerCase().includes(block.text.toLowerCase());

                if (overlayMode === 'fields' && !isHighlighted && (block.confidence || 0) < 0.85) {
                  return null;
                }

                return (
                  <g key={idx}>
                    <rect
                      x={bx}
                      y={by}
                      width={bw}
                      height={bh}
                      fill={isHighlighted ? 'rgba(59, 130, 246, 0.35)' : 'rgba(16, 185, 129, 0.12)'}
                      stroke={isHighlighted ? '#2563EB' : '#10B981'}
                      strokeWidth={isHighlighted ? 3.5 : 1.5}
                      rx="3"
                    />
                    {isHighlighted && (
                      <text
                        x={bx}
                        y={Math.max(14, by - 4)}
                        fill="#FFFFFF"
                        fontSize="12"
                        fontWeight="bold"
                        filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))"
                      >
                        {block.text} ({Math.round(block.confidence * 100)}%)
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        <span>
          {blocks.length} text region{blocks.length === 1 ? '' : 's'} detected by OCR engine
        </span>
        <span className="font-mono">
          {imgWidth} × {imgHeight} px · Zoom: {Math.round(zoom * 100)}%
        </span>
      </div>
    </div>
  );
}
