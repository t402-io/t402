import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Transports - T402";
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
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(ellipse at 50% 30%, rgba(80,175,149,0.15) 0%, transparent 60%)",
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
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
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
            <span style={{ fontSize: "42px", fontWeight: 700, color: "#FAFAFA", letterSpacing: "-0.02em" }}>
              T402
            </span>
          </div>
          <h1
            style={{
              fontSize: "56px",
              fontWeight: 700,
              color: "#FAFAFA",
              lineHeight: 1.2,
              marginBottom: "16px",
              letterSpacing: "-0.02em",
            }}
          >
            Transports
          </h1>
          <p style={{ fontSize: "24px", color: "#71717A", marginBottom: "40px" }}>
            Multiple protocols for payment communication
          </p>
          <div style={{ display: "flex", gap: "16px", alignItems: "center", flexDirection: "row" }}>
            {[
              { name: "HTTP", desc: "REST APIs", color: "#10B981" },
              { name: "MCP", desc: "AI Agents", color: "#8B5CF6" },
              { name: "A2A", desc: "Agent-to-Agent", color: "#F59E0B" },
            ].map((transport) => (
              <div
                key={transport.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  padding: "12px 24px",
                  borderRadius: "16px",
                  backgroundColor: `${transport.color}15`,
                  border: `1px solid ${transport.color}40`,
                }}
              >
                <span style={{ fontSize: "18px", color: transport.color, fontWeight: 600 }}>{transport.name}</span>
                <span style={{ fontSize: "12px", color: "#71717A" }}>{transport.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
