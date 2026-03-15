import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Precision Transfer & Removal — Free Quotes, Same-Day Removal";
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
          background: "linear-gradient(135deg, #071a0e 0%, #0a2614 40%, #0d1f0a 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative green glow */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            left: "-80px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,163,74,0.25) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            right: "-60px",
            width: "350px",
            height: "350px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(234,179,8,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Truck emoji */}
        <div style={{ fontSize: 72, marginBottom: 12, display: "flex" }}>🚛</div>

        {/* Brand */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: "#16a34a",
            letterSpacing: "-1px",
            display: "flex",
            textAlign: "center",
          }}
        >
          PRECISION TRANSFER &amp; REMOVAL
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: "rgba(255,255,255,0.7)",
            marginTop: 4,
            display: "flex",
          }}
        >
          Junk Removal &amp; Moving
        </div>

        {/* Gold banner */}
        <div
          style={{
            marginTop: 28,
            background: "rgba(234,179,8,0.12)",
            border: "2px solid rgba(234,179,8,0.3)",
            borderRadius: 16,
            padding: "14px 40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "#eab308",
              display: "flex",
            }}
          >
            Message for a Free Quote
          </div>
          <div
            style={{
              fontSize: 20,
              color: "rgba(234,179,8,0.6)",
              marginTop: 4,
              display: "flex",
            }}
          >
            Same-Day Removal
          </div>
        </div>

        {/* Phone */}
        <div
          style={{
            marginTop: 24,
            fontSize: 38,
            fontWeight: 800,
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 32, display: "flex" }}>📱</span>
          816-442-2483
        </div>

        {/* Area */}
        <div
          style={{
            position: "absolute",
            bottom: 24,
            fontSize: 18,
            color: "rgba(255,255,255,0.3)",
            display: "flex",
          }}
        >
          Kansas City Metro &bull; tolley.io/moupins
        </div>
      </div>
    ),
    { ...size },
  );
}
