"use client";
export default function AffiliateProfileLink({ href, source, campaign }: { href: string; source: string; campaign: string }) {
  return <a className="haul-button" rel="sponsored" href={href} onClick={() => {
    void fetch("/api/live/visit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, campaign, event: "impact_click" }), keepalive: true }).catch(() => {});
  }}>Explore Treasure Hauls on Whatnot ↗</a>;
}
