"use client";
import { useState } from "react";
export default function JoinHaul() {
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  return <form onSubmit={async e => { e.preventDefault(); setBusy(true); setStatus(""); const f = new FormData(e.currentTarget); try { const r = await fetch("/api/email-capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), source: "shop-drops", data: { joinedFrom: "live", consent: "Treasure Haul drop emails", consentAt: new Date().toISOString() } }) }); if (!r.ok) throw new Error("We couldn’t save your signup. Please try again."); setStatus("You’re on the drop list. Thanks for joining us!"); } catch(e) { setStatus(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); } }}>
    <label htmlFor="haul-email">Your email</label><input id="haul-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com"/><label className="haul-consent"><input type="checkbox" required/> Email me Treasure Haul finds and drop updates.</label><button className="haul-button" disabled={busy}>{busy ? "Joining…" : "Count me in ↗"}</button><p role="status">{status}</p>
  </form>;
}
