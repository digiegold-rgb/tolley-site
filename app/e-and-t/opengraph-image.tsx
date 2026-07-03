import { ImageResponse } from "next/og";

export const alt = "13:13 Weddings & Events — Emily & Trevor Hawk";
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
          backgroundColor: "#f4ece0",
          backgroundImage:
            "radial-gradient(80% 60% at 20% 0%, rgba(201,211,196,0.55), transparent 60%), radial-gradient(60% 50% at 90% 30%, rgba(183,146,104,0.25), transparent 60%)",
          color: "#2a2a26",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "serif",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "#8a6b48",
            fontSize: 22,
            marginBottom: 24,
            display: "flex",
          }}
        >
          faith · hope · love
        </div>
        <div
          style={{
            fontFamily: "serif",
            fontSize: 200,
            fontWeight: 300,
            color: "#b79268",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            display: "flex",
          }}
        >
          13:13
        </div>
        <div
          style={{
            fontFamily: "serif",
            fontStyle: "italic",
            fontSize: 64,
            fontWeight: 300,
            color: "#2a2a26",
            marginTop: 8,
            display: "flex",
          }}
        >
          Weddings &amp; Events
        </div>
        <div
          style={{
            marginTop: 36,
            height: 1,
            width: 220,
            background: "linear-gradient(90deg, transparent, #b79268, transparent)",
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: 36,
            fontFamily: "serif",
            fontStyle: "italic",
            fontSize: 30,
            color: "#5f7a60",
            display: "flex",
          }}
        >
          Emily &amp; Trevor Hawk · Lee&apos;s Summit, MO
        </div>
      </div>
    ),
    { ...size },
  );
}
