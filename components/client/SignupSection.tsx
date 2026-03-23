"use client";

import { useState } from "react";

export function SignupSection() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(type: "email" | "sms") {
    setError("");
    const value = type === "email" ? email : phone;
    if (!value.trim()) return;

    try {
      const res = await fetch("/api/client/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          [type === "email" ? "email" : "phone"]: value.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }
      if (type === "email") setEmailSent(true);
      else setSmsSent(true);
    } catch {
      setError("Network error. Please try again.");
    }
  }

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
        Stay Connected
      </h2>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--cl-text-muted)",
          marginBottom: "1.5rem",
          maxWidth: "600px",
        }}
      >
        Get weekly market updates, new listings, and AI insights delivered to
        your inbox or phone.
      </p>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "#fef2f2",
            color: "#dc2626",
            borderRadius: "8px",
            fontSize: "0.85rem",
            marginBottom: "1rem",
            maxWidth: "500px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.25rem",
          maxWidth: "700px",
        }}
      >
        {/* Email */}
        <div className="cl-card-static" style={{ padding: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--cl-text)",
              marginBottom: "0.75rem",
            }}
          >
            Email Updates
          </div>
          {emailSent ? (
            <div
              style={{
                color: "var(--cl-positive)",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              Subscribed! Check your inbox.
            </div>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="email"
                className="cl-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit("email")}
              />
              <button
                className="cl-cta"
                style={{ padding: "10px 20px", fontSize: "0.85rem" }}
                onClick={() => handleSubmit("email")}
              >
                Subscribe
              </button>
            </div>
          )}
        </div>

        {/* SMS */}
        <div className="cl-card-static" style={{ padding: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--cl-text)",
              marginBottom: "0.75rem",
            }}
          >
            SMS Alerts
          </div>
          {smsSent ? (
            <div
              style={{
                color: "var(--cl-positive)",
                fontWeight: 600,
                fontSize: "0.9rem",
              }}
            >
              Opted in! You&apos;ll get alerts soon.
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="tel"
                  className="cl-input"
                  placeholder="(555) 555-5555"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit("sms")}
                />
                <button
                  className="cl-cta"
                  style={{ padding: "10px 20px", fontSize: "0.85rem" }}
                  onClick={() => handleSubmit("sms")}
                >
                  Opt In
                </button>
              </div>
              <p
                style={{
                  fontSize: "0.65rem",
                  color: "var(--cl-text-light)",
                  marginTop: "0.5rem",
                }}
              >
                Msg & data rates may apply. Reply STOP to cancel.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Social links */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <a
          href="https://www.facebook.com/yourkchomes"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--cl-primary)",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          Facebook
        </a>
        <a
          href="https://www.instagram.com/yourkchomes"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--cl-primary)",
            fontWeight: 600,
            fontSize: "0.85rem",
            textDecoration: "none",
          }}
        >
          Instagram
        </a>
      </div>
    </div>
  );
}
