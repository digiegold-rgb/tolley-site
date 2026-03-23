import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Pool Supply Delivery — Same-Day, Pro Products, KC Metro";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          background: "linear-gradient(135deg, #071a1e 0%, #0a2630 40%, #071a1e 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "450px",
            height: "450px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(6,182,212,0.2) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-80px",
            left: "-80px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        <div style={{ fontSize: 72, marginBottom: 12, display: "flex" }}>🏊</div>

        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "#06b6d4",
            letterSpacing: "-1px",
            display: "flex",
          }}
        >
          Pool Supply Delivery
        </div>

        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
            marginTop: 4,
            display: "flex",
          }}
        >
          Contractor Pricing, Delivered to Your Door
        </div>

        <div style={{ marginTop: 28, display: "flex", gap: 16 }}>
          {["Same-Day", "Pro Products", "KC Metro"].map((text) => (
            <div
              key={text}
              style={{
                background: "rgba(6,182,212,0.12)",
                border: "2px solid rgba(6,182,212,0.25)",
                borderRadius: 12,
                padding: "10px 24px",
                fontSize: 22,
                fontWeight: 700,
                color: "#67e8f9",
                display: "flex",
              }}
            >
              {text}
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 24,
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            display: "flex",
          }}
        >
          Kansas City Metro &bull; tolley.io/pools
        </div>
      </div>
    ),
    { ...size },
  );
}
