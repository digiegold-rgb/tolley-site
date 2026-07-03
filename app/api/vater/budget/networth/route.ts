import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LEDGER_BASE =
  process.env.LEDGER_URL || process.env.LEDGER_BASE_URL || "http://127.0.0.1:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

type Liabilities = {
  totals?: {
    total_balance?: number;
    total_limit?: number;
    overall_utilization_pct?: number | null;
  };
};

export async function GET() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  if (!LEDGER_TOKEN) {
    return NextResponse.json({ ok: false, error: "LEDGER_BEARER_TOKEN not set" }, { status: 503 });
  }

  try {
    const res = await fetch(`${LEDGER_BASE}/plaid/liabilities`, {
      headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `ledger ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as Liabilities;
    const totalBalance = data.totals?.total_balance ?? 0;
    const totalLimit = data.totals?.total_limit ?? 0;
    return NextResponse.json({
      ok: true,
      liabilitiesCents: Math.round(totalBalance * 100),
      creditLimitCents: Math.round(totalLimit * 100),
      utilizationPct: data.totals?.overall_utilization_pct ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
