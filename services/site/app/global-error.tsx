"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ backgroundColor: "#0A0A0B", color: "#FAFAFA", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: "448px", width: "100%", textAlign: "center" }}>
            <div style={{ marginBottom: "32px" }}>
              <span style={{ fontSize: "96px", fontWeight: 700, color: "rgba(239,68,68,0.3)" }}>500</span>
              <h1 style={{ fontSize: "24px", fontWeight: 700, marginTop: "16px" }}>Critical Error</h1>
              <p style={{ color: "#A1A1AA", marginTop: "8px" }}>
                The application encountered a critical error.
              </p>
            </div>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#50AF95",
                color: "#0A0A0B",
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                fontWeight: 500,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
