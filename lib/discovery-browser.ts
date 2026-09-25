"use client";
import { captureAttribution, normalizeAttribution, type Attribution } from "./discovery-attribution";
const KEY = "tolley.discovery.v1";
let memory: Attribution | undefined;
let documentUrl = "";
// A session-scoped first external touch survives internal links and subsite changes.
export function browserAttribution(reportedSource?: string): Attribution | undefined {
  if (typeof window === "undefined") return undefined;
  if (!memory || documentUrl !== window.location.href) {
    const current = captureAttribution(window.location.href, document.referrer);
    documentUrl = window.location.href;
    try { memory = normalizeAttribution(JSON.parse(sessionStorage.getItem(KEY) || "null")) || memory; } catch { /* restricted storage */ }
    if (!memory || current.campaignSource || current.shareSource) memory = current;
    try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* retain in memory */ }
  }
  return { ...memory!, ...(reportedSource?.trim() ? { reportedSource: reportedSource.trim().slice(0, 300) } : {}) };
}
