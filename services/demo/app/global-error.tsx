"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0A0A0B", color: "#FAFAFA", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto" }}>
                <circle cx="24" cy="24" r="20" stroke="#EF4444" strokeWidth="2" opacity="0.3" />
                <path d="M24 16v8m0 8h.02" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
              Application Error
            </h1>
            <p style={{ fontSize: "14px", color: "#71717A", marginBottom: "8px" }}>
              A critical error occurred. This has been logged automatically.
            </p>
            {error.digest && (
              <p style={{ fontSize: "12px", color: "#71717A", fontFamily: "monospace", marginBottom: "16px" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                marginTop: "16px",
                padding: "10px 24px",
                background: "#50AF95",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
