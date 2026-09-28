"use client";
import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { IMPACT_TAG } from "@/lib/live/impact-core";
const key = "treasure-hauls-impact-measurement";
function subscribe(change: () => void) { window.addEventListener("storage", change);window.addEventListener(key, change);return () => {window.removeEventListener("storage",change);window.removeEventListener(key,change);}; }
function preference() { try { return localStorage.getItem(key) === "allow" && navigator.doNotTrack !== "1" && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl; } catch { return false; } }
export default function ImpactPublisher() {
  const allowed = useSyncExternalStore(subscribe, preference, () => false);
  useEffect(() => {
    if (!allowed) return;
    // Leave the publisher document behind when navigating away, including SPA links.
    const leave = (event: MouseEvent) => {
      const a = (event.target as Element)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || a.target === "_blank") return;
      const u = new URL(a.href);
      if (u.origin === location.origin && u.pathname !== "/live") { event.preventDefault(); event.stopImmediatePropagation(); location.assign(u.href); }
    };
    const back = () => { if (location.pathname !== "/live") location.reload(); };
    document.addEventListener("click", leave, true); window.addEventListener("popstate", back);
    return () => { document.removeEventListener("click", leave, true); window.removeEventListener("popstate", back); };
  }, [allowed]);
  function choose(value: boolean) { try { localStorage.setItem(key, value ? "allow" : "decline"); } catch {} if (allowed && !value) { window.location.reload(); return; } window.dispatchEvent(new Event(key)); }
  return <section className="haul-small" aria-label="Affiliate measurement preferences"><p>Optional affiliate measurement helps us understand visits and commissions using Impact. Affiliate links work either way. <a href="/privacy#treasure-hauls">Privacy details</a></p><button type="button" onClick={() => choose(!allowed)}>{allowed ? "Turn off affiliate measurement" : "Allow affiliate measurement"}</button>{!allowed && <span> · Measurement off</span>}
    {allowed && <Script id="treasure-hauls-impact" strategy="afterInteractive">{`(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('${IMPACT_TAG}','script','impactStat',document,window);impactStat('trackImpression');`}</Script>}
  </section>;
}
