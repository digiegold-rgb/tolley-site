"use client";
import { useEffect, useRef, useState } from "react";

export type GenerateAccess = { authenticated: boolean | null; modal?: { configured: boolean }; fal?: { configured: boolean } };
type AccessResponse = GenerateAccess & { code?: string; error?: string; loginUrl?: string };
export function GenerateAccessStatus({ onAccess, onSignedIn }: { onAccess: (access: GenerateAccess) => void; onSignedIn: () => Promise<void> }) {
  const callbacks = useRef({ onAccess, onSignedIn });
  useEffect(() => { callbacks.current = { onAccess, onSignedIn }; });
  const [status, setStatus] = useState<AccessResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const checkRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let mounted = true, pending = false, wasSignedIn = false;
    async function check() {
      if (pending) return;
      pending = true;
      setChecking(true);
      try {
        const r = await fetch("/api/gen2/access", { cache: "no-store" });
        const j = await r.json() as AccessResponse;
        if (!mounted) return;
        const data = { ...j, authenticated: r.ok ? true : r.status === 401 || r.status === 403 ? false : null };
        setStatus(data);
        callbacks.current.onAccess(data);
        if (r.ok && !wasSignedIn) void callbacks.current.onSignedIn().catch(() => { /* Library owns its loading error; authentication remains valid. */ });
        wasSignedIn = r.ok;
      } catch {
        if (mounted) { const unavailable = { authenticated: null, code: "SERVICE_UNAVAILABLE", error: "Could not check access. Your inputs are preserved. Try again." }; setStatus(unavailable); callbacks.current.onAccess(unavailable); }
      } finally { pending = false; if (mounted) setChecking(false); }
    }
    checkRef.current = check;
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => { mounted = false; window.removeEventListener("focus", visible); document.removeEventListener("visibilitychange", visible); };
  }, []);
  const signedIn = status?.authenticated === true;
  const title = signedIn ? "Signed in · owner access" : status?.code === "MFA_REQUIRED" ? "Finish two-factor authentication" : status?.code === "FORBIDDEN" ? "Owner access required" : status?.code === "SERVICE_UNAVAILABLE" ? "Access check unavailable" : status ? "Sign in to Gen2" : "Checking your access…";
  return <section className={`gen-access-status${signedIn ? " is-ready" : ""}`} aria-label="Gen2 access">
    <div role="status"><strong>{title}</strong><p>{signedIn ? "You can submit generations. Provider availability is shown on each workflow." : status?.error || "Checking your account and generation services."}</p>
      {status?.authenticated === false && <p>{status.code === "FORBIDDEN" ? "If you signed in with the wrong account, sign out below and use your owner account. Your inputs stay in this tab." : "Open sign-in below and complete your owner login and authenticator step. Return here; access refreshes automatically and your inputs stay in this tab."}</p>}
    </div>
    <div className="gen-top-actions">
      {status?.authenticated === false && <a className="gen-view-toggle" href={status.code === "FORBIDDEN" ? "/logout" : status.loginUrl?.startsWith("/login") ? status.loginUrl : "/login?callbackUrl=%2Fgen2"} target="_blank" rel="noreferrer">{status.code === "FORBIDDEN" ? "Sign out / switch account ↗" : status.code === "MFA_REQUIRED" ? "Complete two-factor ↗" : "Sign in to Gen2 ↗"}</a>}
      <button className="gen-view-toggle" type="button" disabled={checking} onClick={() => void checkRef.current()}>{checking ? "Checking…" : "Refresh access"}</button>
    </div>
  </section>;
}
