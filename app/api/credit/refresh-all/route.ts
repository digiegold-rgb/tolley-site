import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const LEDGER_URL = process.env.LEDGER_URL || "http://localhost:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

type SourceResult = {
  source: string;
  ok: boolean;
  detail?: string;
  durationMs: number;
};

async function hit(
  source: string,
  path: string,
  timeoutMs: number
): Promise<SourceResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${LEDGER_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LEDGER_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        source,
        ok: false,
        detail: body?.error || `HTTP ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    return {
      source,
      ok: true,
      detail: body?.message || (body?.success ? "ok" : undefined),
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      source,
      ok: false,
      detail: err?.message || "request failed",
      durationMs: Date.now() - start,
    };
  }
}

export async function POST() {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const results = await Promise.all([
    hit("plaid_liabilities", "/plaid/liabilities/sync", 60000),
    hit("scores", "/credit/sync-scores", 15000),
    hit("court_cases", "/credit/court-cases/scan", 15000),
    hit("recommendations", "/credit/recommendations", 60000),
  ]);

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({
    ok: allOk,
    triggeredAt: new Date().toISOString(),
    results,
  });
}
