import { createHash } from "node:crypto";

export const COMPANY_POLICY = Object.freeze({
  version: "2026-10-17.1", monthlyResearchCents: 50_000,
  experimentCents: 1_000, experimentConcurrency: 2, attempts: 3,
  quoteLifetimeMs: 15 * 60_000, leaseMs: 120_000,
  maxInputBytes: 256_000, maxSourceBytes: 1_000_000,
});
export const COMPANY_SCOPES = ["tasks:read", "tasks:write", "knowledge:read", "knowledge:write"] as const;
export type CompanyScope = (typeof COMPANY_SCOPES)[number];
export class CompanyError extends Error {
  constructor(public code: string, public status = 400, message = code) { super(message); }
}
export function monthKey(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${p.find(x => x.type === "year")!.value}-${p.find(x => x.type === "month")!.value}`;
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const fingerprint = (value: unknown) => createHash("sha256").update(stableJson(value)).digest("hex");
export const terminal = (state: string) => ["completed", "failed", "cancelled"].includes(state);
export function cents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) throw new CompanyError("invalid_amount");
  return value;
}
