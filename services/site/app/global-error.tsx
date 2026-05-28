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
          backgroundColor: "#FAFAF7",
          color: "#0F0F0F",
          fontFamily: "Georgia, serif",
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
          <div style={{ maxWidth: "640px", width: "100%" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                color: "#5A5750",
                fontSize: "16px",
                marginBottom: "24px",
              }}
            >
              <span style={{ fontStyle: "italic", color: "#50AF95" }}>N° 500</span>
              <span
                style={{
                  fontFamily:
                    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  fontSize: "12px",
                  fontWeight: 500,
                }}
              >
                Critical Errata
              </span>
            </div>

            <div style={{ borderTop: "1px solid #0F0F0F" }} />

            <h1
              style={{
                fontSize: "48px",
                fontWeight: 500,
                marginTop: "40px",
                marginBottom: "32px",
                color: "#0F0F0F",
                lineHeight: 1.1,
                letterSpacing: "-0.015em",
              }}
            >
              Critical error.
            </h1>

            <div style={{ borderTop: "1px solid #0F0F0F" }} />

            <p
              style={{
                color: "#5A5750",
                marginTop: "32px",
                fontSize: "17px",
                lineHeight: 1.65,
              }}
            >
              The application encountered a critical error.
            </p>

            <button
              onClick={reset}
              style={{
                marginTop: "40px",
                background: "transparent",
                color: "#0F0F0F",
                border: "none",
                fontSize: "18px",
                fontStyle: "italic",
                fontFamily: "Georgia, serif",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationColor: "#50AF95",
                textDecorationThickness: "2px",
                textUnderlineOffset: "6px",
                padding: 0,
              }}
            >
              Reload page →
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
