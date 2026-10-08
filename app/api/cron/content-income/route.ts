import { NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { drainQueue, ensureAccount, syncMetrics } from "@/lib/content-income/store";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_ID, safeError } from "@/lib/content-income/core";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || !secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await drainQueue();
    const a = await ensureAccount();
    if (!a.connectionCheckedAt || Date.now() - a.connectionCheckedAt.getTime() > 6 * 3600000) {
      try { await syncMetrics(); }
      catch (error) { await prisma.contentIncomeAccount.update({ where: { id: ACCOUNT_ID }, data: { metricsError: safeError(error), connectionCheckedAt: new Date() } }); }
    }
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: "Content income worker failed; no automatic resubmission." }, { status: 503 }); }
}
