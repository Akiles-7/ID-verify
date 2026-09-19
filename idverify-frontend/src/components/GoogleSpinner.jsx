import React from 'react';

/**
 * GoogleSpinner — Color-cycling circular SVG spinner matching Google UI aesthetic.
 */
export default function GoogleSpinner({ size = 20, className = "" }) {
  return (
    <svg
      className={`google-spinner ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 50 50"
    >
      <circle
        className="google-spinner-circle"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        strokeWidth="4"
      />
    </svg>
  );
}
