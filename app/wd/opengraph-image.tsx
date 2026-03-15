import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Washer & Dryer Rental Kansas City — Free Delivery, No Contracts";
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
          background: "linear-gradient(135deg, #0a1628 0%, #0f2847 40%, #0a1628 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative blue glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            right: "-100px",
            width: "450px",
            height: "450px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.2) 0%, transparent 70%)",
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
            background: "radial-gradient(circle, rgba(96,165,250,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Bubbles decoration */}
        {[40, 90, 160, 240, 320, 420, 520, 620, 720, 840, 940, 1040].map(
          (x, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                bottom: 10 + (i % 4) * 30,
                left: x,
                width: 12 + (i % 3) * 6,
                height: 12 + (i % 3) * 6,
                borderRadius: "50%",
                border: "1.5px solid rgba(96,165,250,0.15)",
                background: "rgba(96,165,250,0.04)",
                display: "flex",
              }}
            />
          ),
        )}

        {/* W/D emoji */}
        <div style={{ fontSize: 64, marginBottom: 8, display: "flex", gap: 12 }}>
          <span style={{ display: "flex" }}>🫧</span>
          <span style={{ display: "flex" }}>👕</span>
          <span style={{ display: "flex" }}>🫧</span>
        </div>

        {/* Brand */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: "#60a5fa",
            letterSpacing: "-1px",
            display: "flex",
          }}
        >
          Washer &amp; Dryer Rental
        </div>

        {/* Sub */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
            marginTop: 4,
            display: "flex",
          }}
        >
          Your KC Homes LLC
        </div>

        {/* Feature pills */}
        <div
          style={{
            marginTop: 28,
            display: "flex",
            gap: 16,
          }}
        >
          {["Free Delivery", "No Contracts", "Maintenance Included"].map(
            (text) => (
              <div
                key={text}
                style={{
                  background: "rgba(96,165,250,0.12)",
                  border: "2px solid rgba(96,165,250,0.25)",
                  borderRadius: 12,
                  padding: "10px 24px",
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#93c5fd",
                  display: "flex",
                }}
              >
                {text}
              </div>
            ),
          )}
        </div>

        {/* Price */}
        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.4)",
              display: "flex",
            }}
          >
            Starting at
          </span>
          <span
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: "white",
              display: "flex",
            }}
          >
            $42/mo
          </span>
        </div>

        {/* Bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            display: "flex",
          }}
        >
          Kansas City Metro &bull; tolley.io/wd
        </div>
      </div>
    ),
    { ...size },
  );
}
