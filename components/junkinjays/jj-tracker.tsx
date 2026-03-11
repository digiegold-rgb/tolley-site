"use client";

import { useEffect, useCallback } from "react";

export function JjTracker() {
  useEffect(() => {
    // Classify referrer
    const ref = document.referrer || "";
    let source = "direct";
    if (ref.includes("facebook.com") || ref.includes("fb.com")) source = "facebook";
    else if (ref.includes("craigslist.org")) source = "craigslist";
    else if (ref.includes("nextdoor.com")) source = "nextdoor";
    else if (ref.includes("google.com")) source = "google";
    else if (ref.includes("bing.com")) source = "bing";
    else if (ref.includes("offerup.com")) source = "offerup";
    else if (ref.includes("marketplace")) source = "facebook_marketplace";
    else if (ref.includes("tolley.io")) source = "tolley_internal";
    else if (ref) source = ref;

    // Check URL params for manual source tracking (?ref=facebook_post)
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");
    if (refParam) source = refParam;

    // Fire pageview
    fetch("/api/junkinjays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "pageview", referrer: source }),
    }).catch(() => {});
  }, []);

  return null;
}

export function usePhoneClick() {
  return useCallback(() => {
    const ref = document.referrer || "";
    let source = "direct";
    if (ref.includes("facebook")) source = "facebook";
    else if (ref.includes("craigslist")) source = "craigslist";
    else if (ref.includes("nextdoor")) source = "nextdoor";
    else if (ref.includes("tolley.io")) source = "tolley_internal";
    else if (ref) source = ref;

    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");
    if (refParam) source = refParam;

    fetch("/api/junkinjays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "phone_click", referrer: source }),
    }).catch(() => {});
  }, []);
}
