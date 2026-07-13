import { ImageResponse } from "next/og";

export const alt = "Tolley Estate Sales — Full-Service Estate Sales in Kansas City";
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
          backgroundColor: "#171210",
          backgroundImage:
            "radial-gradient(80% 55% at 50% 0%, rgba(201,162,75,0.18), transparent 65%), radial-gradient(50% 40% at 90% 100%, rgba(201,162,75,0.1), transparent 65%)",
          color: "#f3ead9",
          padding: 80,
          textAlign: "center",
        }}
      >
        <div
          style={{
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "#c9a24b",
            fontSize: 24,
            marginBottom: 28,
            display: "flex",
          }}
        >
          Independence · Kansas City
        </div>
        <div
          style={{
            fontFamily: "serif",
            fontSize: 110,
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            display: "flex",
          }}
        >
          Tolley Estate Sales
        </div>
        <div
          style={{
            marginTop: 34,
            height: 2,
            width: 260,
            background: "linear-gradient(90deg, transparent, #c9a24b, transparent)",
            display: "flex",
          }}
        />
        <div
          style={{
            marginTop: 34,
            fontFamily: "serif",
            fontStyle: "italic",
            fontSize: 40,
            color: "#e4c06a",
            display: "flex",
          }}
        >
          A whole house of memories, sold with respect.
        </div>
        <div
          style={{
            marginTop: 30,
            fontSize: 28,
            color: "rgba(243,234,217,0.65)",
            display: "flex",
          }}
        >
          Free walkthrough · Fast settlement · 913-283-3826
        </div>
      </div>
    ),
    { ...size },
  );
}
