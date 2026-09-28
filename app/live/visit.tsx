"use client";
import { useEffect } from "react";
export default function CampaignVisit({ source, campaign }: { source: string; campaign: string }) {
  useEffect(() => {
    const key = `haul-visit:${source}:${campaign}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* storage may be unavailable */ }
    void fetch("/api/live/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, campaign }), keepalive: true }).catch(() => { try { sessionStorage.removeItem(key); } catch {} });
  }, [source, campaign]);
  return null;
}
