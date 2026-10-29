"use client";

import { measurementDenied, openAIReference } from "./openai-ad-attribution";

const KEY = "tolley.cleanouts.openai-click.v1";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
let memory: { reference: string; capturedAt: number } | undefined;

/** Capture on landing and again on submit; never store the full URL or form fields. */
export function cleanoutAdReference(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    if (measurementDenied((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl, navigator.doNotTrack)) {
      memory = undefined;
      try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
      return undefined;
    }
    const now = Date.now();
    const current = openAIReference(new URLSearchParams(window.location.search).get("oppref"));
    if (current) {
      if (memory?.reference !== current) memory = { reference: current, capturedAt: now };
      try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* retain in memory */ }
    } else if (!memory) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(KEY) || "null");
        if (openAIReference(saved?.reference) && typeof saved?.capturedAt === "number") memory = saved;
      } catch { /* malformed or disabled storage */ }
    }
    if (memory && now >= memory.capturedAt && now - memory.capturedAt < MAX_AGE) return memory.reference;
    memory = undefined;
    try { sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
  } catch { /* attribution must never prevent an inquiry */ }
  return undefined;
}
