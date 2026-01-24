import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "T402 Demo — HTTP 402 Payments with USDT";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same image as opengraph-image for consistency across social platforms
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0A0A0B",
          padding: "60px",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at 50% 30%, rgba(80,175,149,0.12) 0%, transparent 60%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "24px",
            left: "24px",
            right: "24px",
            bottom: "24px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #50AF95, #3d8b76)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              T4
            </div>
            <span style={{ fontSize: "36px", fontWeight: 700, color: "#50AF95" }}>
              T402
            </span>
          </div>
          <h1 style={{ fontSize: "52px", fontWeight: 700, color: "#FAFAFA", lineHeight: 1.2, marginBottom: "16px" }}>
            HTTP 402 Payments
          </h1>
          <p style={{ fontSize: "24px", color: "#71717A", marginBottom: "40px" }}>
            Pay for web resources with USDT — no API keys, no subscriptions
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {[
              { name: "EVM", color: "#627EEA" },
              { name: "TON", color: "#0098EA" },
              { name: "Solana", color: "#9945FF" },
              { name: "TRON", color: "#FF0013" },
              { name: "Stacks", color: "#5546FF" },
            ].map((chain) => (
              <div
                key={chain.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: `1px solid ${chain.color}40`,
                  backgroundColor: `${chain.color}15`,
                }}
              >
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: chain.color }} />
                <span style={{ fontSize: "16px", color: chain.color }}>{chain.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "40px", color: "#71717A", fontSize: "16px" }}>
            <span>Request</span>
            <span style={{ color: "#50AF95" }}>→</span>
            <span>402</span>
            <span style={{ color: "#50AF95" }}>→</span>
            <span>Sign</span>
            <span style={{ color: "#50AF95" }}>→</span>
            <span>Settle</span>
            <span style={{ color: "#50AF95" }}>→</span>
            <span>Access</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
