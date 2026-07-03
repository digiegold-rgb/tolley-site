import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Ruthann's Kitchen — Smart Meal Planning, Grocery Lists & Pantry Tracking for Real Families";
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
          // Cute pink → lavender gradient to match the landing page
          background:
            "linear-gradient(135deg, #fdf2f8 0%, #fce4ec 35%, #f3e5f5 70%, #ede9fe 100%)",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
          padding: "60px",
        }}
      >
        {/* Soft pink glow top-right */}
        <div
          style={{
            position: "absolute",
            top: "-180px",
            right: "-180px",
            width: "620px",
            height: "620px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(244, 114, 182, 0.35) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        {/* Soft lavender glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-140px",
            left: "-140px",
            width: "560px",
            height: "560px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(192, 132, 252, 0.28) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 22px",
            borderRadius: "999px",
            background: "rgba(244, 114, 182, 0.15)",
            border: "2px solid rgba(244, 114, 182, 0.4)",
            color: "#be185d",
            fontSize: "22px",
            fontWeight: 700,
            marginBottom: "40px",
          }}
        >
          <span>💝</span>
          <span>Your Yummly recipes don&apos;t have to die</span>
        </div>

        {/* 🍳 + Ruthann's Kitchen — big, inline, centered */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "20px",
          }}
        >
          <div style={{ fontSize: "96px", display: "flex" }}>🍳</div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                fontSize: "86px",
                fontWeight: 900,
                color: "#4a2040",
                letterSpacing: "-2px",
                lineHeight: 1,
                display: "flex",
              }}
            >
              Ruthann&apos;s
            </div>
            <div
              style={{
                fontSize: "86px",
                fontWeight: 900,
                background: "linear-gradient(135deg, #f472b6, #c084fc)",
                backgroundClip: "text",
                color: "transparent",
                letterSpacing: "-2px",
                lineHeight: 1,
                marginTop: "6px",
                display: "flex",
              }}
            >
              Kitchen
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "32px",
            color: "#7c5068",
            fontWeight: 500,
            textAlign: "center",
            marginTop: "28px",
            maxWidth: "920px",
            lineHeight: 1.3,
            display: "flex",
          }}
        >
          Smart meal planning, grocery lists &amp; pantry tracking for real families.
        </div>

        {/* Feature chips */}
        <div
          style={{
            marginTop: "38px",
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {[
            { label: "AI meal plans", emoji: "📅" },
            { label: "Pantry tracker", emoji: "🗄️" },
            { label: "Receipt scanning", emoji: "📷" },
            { label: "$39 / year", emoji: "💝" },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                background: "rgba(255, 255, 255, 0.85)",
                border: "2px solid rgba(244, 114, 182, 0.32)",
                borderRadius: "16px",
                padding: "12px 22px",
                fontSize: "24px",
                fontWeight: 700,
                color: "#4a2040",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <span>{chip.emoji}</span>
              <span>{chip.label}</span>
            </div>
          ))}
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: "absolute",
            bottom: "28px",
            fontSize: "22px",
            color: "#9d5b82",
            fontWeight: 600,
            display: "flex",
          }}
        >
          tolley.io/food
        </div>
      </div>
    ),
    { ...size },
  );
}
