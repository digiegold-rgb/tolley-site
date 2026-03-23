"use client";

import { LocationBadge, type GeoLocation } from "./LocationDetector";

export type ClientRole = "buyer" | "seller";

export function ClientHero({
  location,
  locationLoading,
  role,
  onRoleChange,
}: {
  location: GeoLocation;
  locationLoading: boolean;
  role: ClientRole;
  onRoleChange: (role: ClientRole) => void;
}) {
  return (
    <section className="cl-hero" style={{ position: "relative", overflow: "hidden" }}>
      {/* Decorative gold-tinted circles */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-60px",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "rgba(201, 168, 76, 0.04)",
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: "absolute",
          bottom: "-40px",
          left: "-40px",
          width: "200px",
          height: "200px",
          borderRadius: "50%",
          background: "rgba(201, 168, 76, 0.03)",
        }}
        aria-hidden="true"
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "80rem",
          margin: "0 auto",
          padding: "4rem 1.25rem 3.5rem",
          textAlign: "center",
        }}
      >
        <LocationBadge location={location} loading={locationLoading} />

        <h1
          style={{
            marginTop: "1.5rem",
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 800,
            color: "#F2F0EB",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          Your KC Real Estate
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #C9A84C, #E8D5A3)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Intelligence Hub
          </span>
        </h1>

        <p
          style={{
            marginTop: "1rem",
            fontSize: "1.1rem",
            color: "rgba(242, 240, 235, 0.65)",
            maxWidth: "600px",
            margin: "1rem auto 0",
            lineHeight: 1.6,
            fontWeight: 300,
          }}
        >
          Live market data, AI-powered signals, and hyper-local listings —
          updated every 5 minutes by 25 autonomous agents.
        </p>

        <div style={{ marginTop: "1.5rem" }}>
          <div className="cl-toggle">
            <button
              className={role === "buyer" ? "active" : ""}
              onClick={() => onRoleChange("buyer")}
            >
              I&apos;m Buying
            </button>
            <button
              className={role === "seller" ? "active" : ""}
              onClick={() => onRoleChange("seller")}
            >
              I&apos;m Selling
            </button>
          </div>
        </div>
      </div>

      {/* Bottom wave */}
      <svg
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        style={{
          display: "block",
          width: "100%",
          height: "40px",
          position: "relative",
          zIndex: 1,
        }}
        fill="#08080A"
      >
        <path d="M0,60 L0,30 Q360,0 720,30 Q1080,60 1440,30 L1440,60 Z" />
      </svg>
    </section>
  );
}
