import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "T402 - Open-source HTTP Payment Protocol for Stablecoins";
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
              "radial-gradient(ellipse at 50% 30%, rgba(80,175,149,0.15) 0%, transparent 60%)",
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
          {/* Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              marginBottom: "32px",
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
                fontSize: "24px",
                fontWeight: 700,
              }}
            >
              T4
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
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "#FAFAFA",
              lineHeight: 1.2,
              marginBottom: "16px",
              letterSpacing: "-0.02em",
            }}
          >
            Open HTTP Payment Protocol
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: "48px",
              fontWeight: 700,
              color: "#50AF95",
              lineHeight: 1.2,
              marginBottom: "32px",
              letterSpacing: "-0.02em",
            }}
          >
            for Stablecoins
          </p>

          {/* Description */}
          <p
            style={{
              fontSize: "22px",
              color: "#71717A",
              marginBottom: "40px",
            }}
          >
            HTTP-native stablecoin payments across 13 blockchain families
          </p>

          {/* Chain badges */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: "900px",
            }}
          >
            {[
              { name: "EVM", color: "#627EEA" },
              { name: "Solana", color: "#9945FF" },
              { name: "TON", color: "#0098EA" },
              { name: "TRON", color: "#FF0000" },
              { name: "NEAR", color: "#00EC97" },
              { name: "Aptos", color: "#2DD8A3" },
              { name: "Tezos", color: "#2C7DF7" },
              { name: "Polkadot", color: "#E6007A" },
              { name: "Stacks", color: "#5546FF" },
              { name: "+35", color: "#71717A" },
            ].map((chain) => (
              <div
                key={chain.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 12px",
                  borderRadius: "14px",
                  border: `1px solid ${chain.color}40`,
                  backgroundColor: `${chain.color}15`,
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
