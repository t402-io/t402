import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "Add Payments to Your Express.js API in 5 Minutes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const title = "Add Payments to Your Express.js API in 5 Minutes";
const category = "Tutorial";
const color = "#F59E0B";
const slug = "getting-started-express";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
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
            background: `radial-gradient(ellipse at 50% 0%, ${color}25 0%, transparent 50%)`,
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
            justifyContent: "space-between",
            height: "100%",
            zIndex: 1,
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #50AF95, #26A17B)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "18px",
                  fontWeight: 700,
                }}
              >
                T4
              </div>
              <span style={{ fontSize: "28px", fontWeight: 700, color: "#FAFAFA" }}>T402</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                borderRadius: "20px",
                backgroundColor: `${color}20`,
                border: `1px solid ${color}40`,
              }}
            >
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, display: "flex" }} />
              <span style={{ fontSize: "16px", fontWeight: 600, color: color }}>{category}</span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
              flex: 1,
              paddingTop: "40px",
              paddingBottom: "40px",
            }}
          >
            <h1
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color: "#FAFAFA",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                maxWidth: "900px",
              }}
            >
              {title}
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "18px", color: "#71717A" }}>t402.io/writing/{slug}</span>
            <div style={{ display: "flex", gap: "8px", flexDirection: "row" }}>
              {["Express.js", "TypeScript", "Node.js", "5 min"].map((tag) => (
                <div
                  key={tag}
                  style={{
                    display: "flex",
                    padding: "6px 12px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#A1A1AA", fontWeight: 500 }}>{tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
