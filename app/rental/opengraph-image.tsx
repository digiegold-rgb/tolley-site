import { ImageResponse } from "next/og";

export const alt = "Rentals — Washers, Dryers, Trailers & Generators · Independence, MO";
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
          backgroundColor: "#0b1220",
          backgroundImage:
            "radial-gradient(80% 55% at 50% 0%, rgba(56,189,248,0.22), transparent 65%), radial-gradient(50% 40% at 90% 100%, rgba(56,189,248,0.1), transparent 65%)",
          color: "#e8f4fb",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div
          style={{
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "#38bdf8",
            fontSize: 24,
            marginBottom: 28,
            display: "flex",
          }}
        >
          Independence · Kansas City
        </div>
        <div
          style={{
            fontSize: 100,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          Rentals Made Easy
        </div>
        <div
          style={{
            marginTop: 34,
            height: 2,
            width: 260,
            background: "linear-gradient(90deg, transparent, #38bdf8, transparent)",
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: 34,
            fontSize: 40,
            color: "#7dd3fc",
            display: "flex",
          }}
        >
          Washers · Dryers · Trailers · Generators
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 28,
            color: "rgba(232,244,251,0.65)",
            display: "flex",
          }}
        >
          Free delivery &amp; setup · 913-283-3826 · tolley.io/rental
        </div>
      </div>
    ),
    { ...size },
  );
}
