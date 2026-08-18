"use client";

import { useState } from "react";

/**
 * /hq/sentry-check — Sentry smoke test console.
 *
 * Two buttons, two runtimes: the browser one calls an undefined function so
 * the global error handler in instrumentation-client.ts reports it, and the
 * server one hits /api/hq/sentry-check, which throws inside a route handler
 * so `onRequestError` reports it. Both produce genuine uncaught errors —
 * that's the point; a hand-rolled captureException would pass even with the
 * hooks unwired.
 */
export default function HqSentryCheck() {
  const [serverResult, setServerResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function fireServerError() {
    setBusy(true);
    setServerResult(null);
    try {
      const res = await fetch("/api/hq/sentry-check", { cache: "no-store" });
      setServerResult(
        res.status === 401
          ? "401 — sign in to HQ first; this route is admin-gated so it can't be used to drain the Sentry quota."
          : `Server responded ${res.status} — expected 500. Error is on its way to Sentry.`,
      );
    } catch (err) {
      setServerResult(`Request failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: "2.5rem 1.5rem", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: ".5rem" }}>
        Sentry smoke test
      </h1>
      <p style={{ opacity: 0.75, lineHeight: 1.5, marginBottom: "1.75rem" }}>
        Fires a real uncaught error in each runtime, then check{" "}
        <a
          href="https://sentry.io/issues/"
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "underline" }}
        >
          Sentry Issues
        </a>
        . Both errors are expected — nothing here touches live data.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: ".75rem" }}>
        <button
          type="button"
          onClick={() => {
            // Intentionally undefined — this is the browser-side trigger.
            (window as unknown as { myUndefinedFunction: () => void })
              .myUndefinedFunction();
          }}
          style={buttonStyle}
        >
          Throw a browser error
        </button>

        <button
          type="button"
          onClick={fireServerError}
          disabled={busy}
          style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Firing…" : "Throw a server error"}
        </button>
      </div>

      {serverResult && (
        <p style={{ marginTop: "1.25rem", opacity: 0.8 }}>{serverResult}</p>
      )}
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: ".75rem 1.1rem",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.25)",
  background: "rgba(255,255,255,.06)",
  color: "inherit",
  fontSize: ".95rem",
  cursor: "pointer",
  textAlign: "left",
};
