import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "SDKs - T402";
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
            Official SDKs
          </h1>
          <p style={{ fontSize: "24px", color: "#71717A", marginBottom: "40px" }}>
            Production-ready libraries in 4 languages
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexDirection: "row" }}>
            {[
              { name: "TypeScript", color: "#3178C6" },
              { name: "Go", color: "#00ADD8" },
              { name: "Python", color: "#3776AB" },
              { name: "Java", color: "#ED8B00" },
            ].map((lang) => (
              <div
                key={lang.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  borderRadius: "16px",
                  backgroundColor: `${lang.color}15`,
                  border: `1px solid ${lang.color}40`,
                }}
              >
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: lang.color }} />
                <span style={{ fontSize: "16px", color: lang.color, fontWeight: 600 }}>{lang.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
