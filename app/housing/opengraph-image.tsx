import { ImageResponse } from "next/og";

export const alt = "KC Housing Daily — Kansas City Market Pulse";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
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
          backgroundColor: "#0a1510",
          backgroundImage:
            "radial-gradient(80% 55% at 50% 0%, rgba(52,211,153,0.2), transparent 65%), radial-gradient(50% 40% at 90% 100%, rgba(52,211,153,0.1), transparent 65%)",
          color: "#eafaf2",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div
          style={{
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "#34d399",
            fontSize: 24,
            marginBottom: 28,
            display: "flex",
          }}
        >
          Fresh Every Morning
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          KC Housing Daily
        </div>
        <div
          style={{
            marginTop: 34,
            height: 2,
            width: 260,
            background: "linear-gradient(90deg, transparent, #34d399, transparent)",
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: 34,
            fontSize: 40,
            color: "#6ee7b7",
            display: "flex",
          }}
        >
          Rates · Prices · What your home is worth
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 28,
            color: "rgba(234,250,242,0.65)",
            display: "flex",
          }}
        >
          Local Independence MO agent · 913-283-3826 · tolley.io/housing
        </div>
      </div>
    ),
    { ...size },
  );
}
