import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "T402 Demo - Interactive HTTP 402 Payments with USDT across 44 Networks";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        {/* Background gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(80,175,149,0.12) 0%, transparent 60%)",
            display: "flex",
          }}
        />

        {/* Border frame */}
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

        {/* Content */}
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
          {/* Brand + Demo badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "36px",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "14px",
                background: "linear-gradient(135deg, #50AF95, #26A17B)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "22px",
                fontWeight: 700,
              }}
            >
              402
            </div>
            <span
              style={{
                fontSize: "42px",
                fontWeight: 700,
                color: "#FAFAFA",
                letterSpacing: "-0.02em",
              }}
            >
              T402
            </span>
            <div
              style={{
                display: "flex",
                padding: "6px 14px",
                borderRadius: "8px",
                backgroundColor: "#50AF9520",
                border: "1px solid #50AF9540",
              }}
            >
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "#50AF95",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Demo
              </span>
            </div>
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "52px",
              fontWeight: 700,
              color: "#FAFAFA",
              lineHeight: 1.15,
              marginBottom: "20px",
              letterSpacing: "-0.02em",
            }}
          >
            HTTP 402 Payments
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "28px",
              color: "#71717A",
              marginBottom: "40px",
              lineHeight: 1.4,
            }}
          >
            Pay for APIs, content, and AI with USDT across 44 networks
          </p>

          {/* Flow diagram */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "40px",
            }}
          >
            {[
              { step: "Request", color: "#71717A" },
              { step: "402", color: "#50AF95" },
              { step: "Sign", color: "#71717A" },
              { step: "Settle", color: "#71717A" },
              { step: "Access", color: "#10B981" },
            ].map((item, i) => (
              <div key={item.step} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    backgroundColor: item.step === "402" ? "#50AF9520" : "#1a1a1c",
                    border: `1px solid ${item.step === "402" ? "#50AF9540" : "#2A2A2D"}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      color: item.color,
                    }}
                  >
                    {item.step}
                  </span>
                </div>
                {i < 4 && (
                  <span style={{ color: "#2A2A2D", fontSize: "20px" }}>→</span>
                )}
              </div>
            ))}
          </div>

          {/* Chain badges */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
            }}
          >
            {[
              { name: "EVM", color: "#627EEA" },
              { name: "Solana", color: "#9945FF" },
              { name: "TON", color: "#0098EA" },
              { name: "TRON", color: "#FF0013" },
              { name: "NEAR", color: "#00C08B" },
              { name: "Aptos", color: "#2DD4BF" },
              { name: "Tezos", color: "#2C7DF7" },
              { name: "Polkadot", color: "#E6007A" },
              { name: "Stacks", color: "#5546FF" },
              { name: "Cosmos", color: "#B7B9C8" },
            ].map((chain) => (
              <div
                key={chain.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "5px 10px",
                  borderRadius: "12px",
                  border: `1px solid ${chain.color}30`,
                  backgroundColor: `${chain.color}10`,
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: chain.color,
                  }}
                />
                <span style={{ fontSize: "12px", color: chain.color, fontWeight: 500 }}>
                  {chain.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
