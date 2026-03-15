import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ScannerName, ActivitySeverity } from "./types";

/**
 * Log a scan activity event to the ScanActivity table.
 * Fire-and-forget — errors are swallowed to never break the caller.
 */
export async function logScanActivity(
  scanner: ScannerName,
  title: string,
  opts?: {
    event?: string;
    detail?: string;
    severity?: ActivitySeverity;
    meta?: Record<string, unknown>;
  }
) {
  try {
    await prisma.scanActivity.create({
      data: {
        scanner,
        event: opts?.event ?? "info",
        title,
        detail: opts?.detail ?? null,
        severity: opts?.severity ?? "info",
        meta: opts?.meta
          ? (opts.meta as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  } catch (e) {
    console.error("[scan/log] Failed to log activity:", e);
  }
}

/**
 * Start a scan run. Returns the run ID for later completion.
 */
export async function startScanRun(
  scanner: ScannerName,
  meta?: Record<string, unknown>
): Promise<string> {
  try {
    const run = await prisma.scanRun.create({
      data: {
        scanner,
        status: "running",
        meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
    return run.id;
  } catch (e) {
    console.error("[scan/log] Failed to start run:", e);
    return "";
  }
}

/**
 * Complete a scan run.
 */
export async function completeScanRun(
  runId: string,
  opts: {
    itemsFound?: number;
    alertsGen?: number;
    error?: string;
  }
) {
  if (!runId) return;
  try {
    const run = await prisma.scanRun.findUnique({ where: { id: runId } });
    const duration = run
      ? Date.now() - run.startedAt.getTime()
      : null;

    await prisma.scanRun.update({
      where: { id: runId },
      data: {
        status: opts.error ? "failed" : "complete",
        itemsFound: opts.itemsFound ?? 0,
        alertsGen: opts.alertsGen ?? 0,
        duration,
        error: opts.error ?? null,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    console.error("[scan/log] Failed to complete run:", e);
  }
}
