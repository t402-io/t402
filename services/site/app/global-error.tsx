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
      <body
        style={{
          backgroundColor: "#0A0A0B",
          color: "#FAFAFA",
          fontFamily:
            '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          margin: 0,
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              maxWidth: "448px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: "40px" }}>
              <span
                style={{
                  fontSize: "96px",
                  fontWeight: 700,
                  color: "rgba(239,68,68,0.2)",
                }}
              >
                500
              </span>
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  marginTop: "16px",
                  color: "#FAFAFA",
                }}
              >
                Critical Error
              </h1>
              <p
                style={{
                  color: "#A1A1AA",
                  marginTop: "12px",
                  fontSize: "16px",
                  lineHeight: 1.6,
                }}
              >
                The application encountered a critical error.
              </p>
            </div>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#50AF95",
                color: "#0A0A0B",
                padding: "12px 24px",
                borderRadius: "12px",
                border: "none",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                transition: "background-color 300ms",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.backgroundColor = "#26A17B")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.backgroundColor = "#50AF95")
              }
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
