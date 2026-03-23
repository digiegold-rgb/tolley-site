"use client";

import { useState } from "react";
import { SellScoreViz } from "./SellScoreViz";

export function SellerSection() {
  const [address, setAddress] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 800,
          color: "var(--cl-text)",
          marginBottom: "0.5rem",
        }}
      >
        Thinking of Selling?
      </h2>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--cl-text-muted)",
          marginBottom: "1.25rem",
          maxWidth: "600px",
        }}
      >
        Enter your address for an AI-powered sell score and comparable analysis.
      </p>

      <div
        className="cl-card-static"
        style={{
          padding: "2rem",
          maxWidth: "600px",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="text"
            className="cl-input"
            placeholder="Enter your property address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button
            className="cl-cta"
            style={{ whiteSpace: "nowrap", padding: "12px 24px" }}
            onClick={() => {
              if (address.trim()) setSubmitted(true);
            }}
          >
            Analyze
          </button>
        </div>

        {submitted && (
          <div style={{ marginTop: "1.5rem" }}>
            <SellScoreViz score={72} />
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem",
                background: "var(--cl-primary-pale)",
                borderRadius: "12px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  color: "var(--cl-primary)",
                }}
              >
                Want the full dossier with comps, tax data, and AI analysis?
              </p>
              <a
                href="tel:913-283-3826"
                className="cl-cta"
                style={{
                  display: "inline-block",
                  marginTop: "0.75rem",
                  textDecoration: "none",
                }}
              >
                Get Full Dossier — Call Jared
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
