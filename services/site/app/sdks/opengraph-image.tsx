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
          justifyContent: "space-between",
          backgroundColor: "#FAFAF7",
          padding: "72px 88px",
          fontFamily: "Georgia, serif",
          color: "#0F0F0F",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            color: "#5A5750",
            fontSize: "22px",
          }}
        >
          <span style={{ fontStyle: "italic", color: "#50AF95" }}>N° 402.SDK</span>
          <span
            style={{
              fontFamily: "Arial, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: "16px",
              fontWeight: 500,
            }}
          >
            Build with T402
          </span>
        </div>

        <div style={{ display: "flex", borderTop: "1px solid #0F0F0F", marginTop: "24px" }} />

        <div style={{ display: "flex", flexDirection: "column", marginTop: "60px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "96px",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Official SDKs.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "96px",
              fontWeight: 500,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
            }}
          >
            Four languages.
          </div>
        </div>

        <div style={{ display: "flex", borderTop: "1px solid #0F0F0F" }} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            fontSize: "22px",
            color: "#5A5750",
          }}
        >
          <span style={{ fontStyle: "italic" }}>
            TypeScript · Python · Go · Java
          </span>
          <span
            style={{
              fontFamily: "Arial, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: "16px",
              color: "#0F0F0F",
              fontWeight: 600,
            }}
          >
            t402.io/sdks
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
