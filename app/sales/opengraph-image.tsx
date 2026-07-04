import { ImageResponse } from "next/og";

export const alt = "The Launchpad — You Can Still Start | Tolley.io";
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
          backgroundColor: "#15110d",
          backgroundImage:
            "radial-gradient(ellipse 65% 55% at 50% 0%, rgba(245,166,35,0.28), transparent 70%)",
          color: "#f3ead9",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#f5a623",
            fontSize: 22,
            marginBottom: 28,
            display: "flex",
          }}
        >
          Tolley.io · Independence, MO
        </div>
        <div
          style={{
            fontFamily: "sans-serif",
            fontWeight: 800,
            textTransform: "uppercase",
            fontSize: 88,
            lineHeight: 1.02,
            letterSpacing: "-0.01em",
            display: "flex",
          }}
        >
          You Can Still Start
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: "sans-serif",
            fontSize: 32,
            color: "#c9bca3",
            maxWidth: 900,
            display: "flex",
          }}
        >
          No license. No bank account. A record. Bring the idea &mdash; Jared brings everything else.
        </div>
        <div
          style={{
            marginTop: 40,
            height: 2,
            width: 240,
            background: "#f5a623",
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: 30,
            fontFamily: "sans-serif",
            fontSize: 24,
            fontWeight: 700,
            color: "#f5a623",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            display: "flex",
          }}
        >
          The Launchpad
        </div>
      </div>
    ),
    { ...size },
  );
}
