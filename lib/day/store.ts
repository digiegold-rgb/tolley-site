import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaTimeout } from "@/lib/prisma-url";
import { pullSnapshot } from "./sources";
import { snapshotSchema, type DayView } from "./core";

// Existing durable PostgreSQL storage; never filesystem, browser storage, or a new table.
// Branch previews sharing the production DB must not overwrite its snapshot.
export function snapshotKey() {
  if (process.env.VERCEL_ENV === "production") return "day:snapshot:v1:production";
  const scope = `${process.env.VERCEL_ENV || "local"}:${process.env.VERCEL_GIT_COMMIT_REF || "day"}`;
  return `day:snapshot:v1:${createHash("sha256").update(scope).digest("hex").slice(0, 20)}`;
}

export async function readSnapshot(): Promise<DayView> {
  const result = await withPrismaTimeout((async (): Promise<DayView> => {
    const row = await prisma.siteEvent.findUnique({ where: { eventKey: snapshotKey() }, select: { meta: true } });
    if (!row) return { snapshot: null, storage: "ready" };
    const parsed = snapshotSchema.safeParse(row.meta);
    return parsed.success ? { snapshot: parsed.data, storage: "ready" } : { snapshot: null, storage: "unavailable" };
  })(), { snapshot: null, storage: "unavailable" } as DayView);
  return result;
}

export async function refreshSnapshot(): Promise<DayView> {
  const snapshot = await pullSnapshot();
  const key = snapshotKey();
  const result = await withPrismaTimeout(prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
    const existing = await tx.siteEvent.findUnique({ where: { eventKey: key }, select: { meta: true } });
    const previous = snapshotSchema.safeParse(existing?.meta);
    if (previous.success && previous.data.generatedAt > snapshot.generatedAt) return previous.data;
    const data = { meta: snapshot as unknown as Prisma.InputJsonValue, createdAt: new Date(snapshot.generatedAt) };
    await tx.siteEvent.upsert({ where: { eventKey: key },
      create: { eventKey: key, site: "day", path: "/day", event: "day_snapshot_heartbeat", audience: "owner", ...data }, update: data });
    return snapshot;
  }, { timeout: 6_000 }), null, 8_000);
  // Live results remain usable, but UI and cron must report a failed durable write.
  return { snapshot: result ?? snapshot, storage: result ? "ready" : "unavailable" };
}
