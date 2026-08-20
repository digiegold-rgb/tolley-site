/**
 * GET /api/hq/jelly-pnl — Jelly Studio (/animate) P&L for the /hq card.
 *
 * Customer side only: unmetered accounts (Trey, Jared) are house business and
 * belong to /api/hq/vater-payment + getVaterBillingSummary. Same boundary that
 * picks the Modal lane — see lib/vater/owner-tier.ts.
 *
 * ?days=N windows the P&L lines (default all-time). Customer BALANCES are
 * always all-time regardless: a windowed balance is a number that never
 * existed.
 *
 * Auth: validateWdAdmin() (the /hq PIN cookie), matching every other /api/hq
 * route. This payload contains customer emails and their per-video charges, so
 * it is never public and never cached.
 */
import { NextRequest, NextResponse } from "next/server";

import { validateWdAdmin } from "@/lib/wd-auth";
import { getJellyPnl } from "@/lib/vater/billing/jelly-pnl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(req: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  const raw = req.nextUrl.searchParams.get("days");
  const parsed = raw ? Number(raw) : NaN;
  const days =
    Number.isFinite(parsed) && parsed > 0 ? Math.min(3650, Math.floor(parsed)) : undefined;

  try {
    const pnl = await getJellyPnl(days ? { days } : undefined);
    return NextResponse.json(pnl, { headers: NO_STORE });
  } catch (err) {
    // Surface it — a P&L that silently renders zeros is worse than one that
    // says it failed (feedback_silent_failures_leads).
    console.error("[hq/jelly-pnl] failed", err);
    return NextResponse.json(
      {
        error: "Jelly P&L failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500, headers: NO_STORE },
    );
  }
}
