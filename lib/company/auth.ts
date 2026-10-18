import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { requireApiKey } from "@/lib/vater/direct-auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { COMPANY_POLICY, CompanyError, type CompanyScope } from "./policy";

export type Principal = { userId: string; keyId: string; monthlyLimitCents: number; scopes: string[] };
export async function principal(req: NextRequest, scope: CompanyScope): Promise<Principal> {
  const auth = await requireApiKey(req, { allowCompany: true });
  if (!auth.ok) throw new CompanyError("unauthorized", auth.response.status);
  const grant = await prisma.companyKeyGrant.findUnique({ where: { keyId: auth.keyId } });
  if (!grant || grant.userId !== auth.userId || !grant.scopes.includes(scope)) throw new CompanyError("scope_required", 403, `Enable ${scope} for this key in /services/agent.`);
  const limit = await consumeRateLimit(`company:${auth.keyId}`, scope === "tasks:write" ? 30 : 120, 60);
  if (!limit.allowed) throw new CompanyError("rate_limited", 429);
  return { userId: auth.userId, keyId: auth.keyId, monthlyLimitCents: grant.monthlyLimitCents, scopes: grant.scopes };
}
export async function body(req: Request) {
  if (Number(req.headers.get("content-length") || 0) > COMPANY_POLICY.maxInputBytes) throw new CompanyError("request_too_large", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new CompanyError("invalid_json");
  let length = 0; const parts: Uint8Array[] = [];
  for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > COMPANY_POLICY.maxInputBytes) { await reader.cancel(); throw new CompanyError("request_too_large", 413); } parts.push(value); }
  try { return JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { throw new CompanyError("invalid_json"); }
}
export function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); }
export async function endpoint(fn: () => Promise<Response>) {
  try { return await fn(); } catch (e) {
    if (e instanceof CompanyError) return json({ error: e.code, message: e.message }, e.status);
    if (e && typeof e === "object" && "name" in e && e.name === "ZodError") return json({ error: "invalid_request", message: "Input does not match the documented schema." }, 400);
    console.error("[company] request failed", e instanceof Error ? e.name : "unknown");
    return json({ error: "temporarily_unavailable", message: "The operation could not be completed. Retry with the same idempotency key." }, 503);
  }
}
