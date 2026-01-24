import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "T402 - The Official Payment Protocol for USDT";
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
            The Official Payment Protocol
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
            for USDT
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: "32px",
              alignItems: "center",
            }}
          >
            {[
              { value: "28", label: "Chains" },
              { value: "0%", label: "Fees" },
              { value: "4", label: "SDKs" },
              { value: "<1s", label: "Settlement" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <span style={{ fontSize: "28px", fontWeight: 700, color: "#FAFAFA" }}>
                  {stat.value}
                </span>
                <span style={{ fontSize: "14px", color: "#71717A" }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
