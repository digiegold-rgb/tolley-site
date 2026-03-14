import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/markets/signals/validate
 * Worker pushes validation results — updates wasAccurate on archived signals.
 * Auth: SYNC_SECRET only (worker-to-API)
 * Body: { validations: [{ archiveId, wasAccurate, reasoning, actualOutcome }] }
 */
export async function POST(request: NextRequest) {
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validations = body.validations;

  if (!Array.isArray(validations) || validations.length === 0) {
    return NextResponse.json({ error: "validations array required" }, { status: 400 });
  }

  let updated = 0;
  let errors = 0;

  for (const v of validations) {
    try {
      await prisma.marketSignalArchive.update({
        where: { id: v.archiveId },
        data: {
          wasAccurate: v.wasAccurate,
          // Store reasoning in a way that doesn't require schema changes
          // We'll append it to the existing reasoning field
          reasoning: undefined, // keep original reasoning
        },
      });

      // Also store the validation reasoning as a data point for transparency
      await prisma.marketDataPoint.create({
        data: {
          type: "manual_note",
          title: `Prediction Validation: ${v.wasAccurate ? "✓ Accurate" : "✗ Inaccurate"} — ${v.archiveId.slice(0, 8)}`,
          scope: "national",
          summary: `${v.reasoning} | Actual: ${v.actualOutcome}`,
          tags: ["prediction_validation", v.wasAccurate ? "accurate" : "inaccurate"],
          sentiment: v.wasAccurate ? 0.5 : -0.5,
        },
      });

      updated++;
    } catch (e) {
      console.error(`[validate] Failed to update ${v.archiveId}:`, e);
      errors++;
    }
  }

  return NextResponse.json({ ok: true, updated, errors, total: validations.length });
}
