import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { heatIngestAuthorized, validateHeatAccess } from "@/lib/heat/auth";
import { heatCommandSchema } from "@/lib/heat/planner-schema";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!heatIngestAuthorized(request.headers.get("authorization"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cutoff = new Date(Date.now() - 600_000);
  await prisma.heatCommand.updateMany({ where: { status: "queued", createdAt: { lt: cutoff } }, data: { status: "expired" } });
  const rows = await prisma.heatCommand.findMany({ where: { status: "queued", createdAt: { gte: cutoff } }, orderBy: { createdAt: "asc" }, take: 20 });
  return NextResponse.json({ commands: rows.map(r => ({ ...(r.params as object), action: r.action, id: r.id, created_at: r.createdAt.getTime() / 1000 })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!await validateHeatAccess()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") || "");
    sameOrigin = origin.host === request.headers.get("host") &&
      (origin.protocol === "https:" || (process.env.NODE_ENV !== "production" && origin.protocol === "http:"));
  } catch { /* missing and opaque origins are rejected */ }
  if (!sameOrigin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const limited = await rateLimitByIp(request, "heat:commands", 30, 3600);
  if (limited) return limited;
  const text = await request.text();
  if (text.length > 1000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  let cmd;
  try { cmd = heatCommandSchema.parse(JSON.parse(text)); }
  catch { return NextResponse.json({ error: "Invalid control request" }, { status: 400 }); }
  const row = await prisma.heatCommand.create({ data: { id: randomUUID(), action: cmd.action, params: cmd } });
  return NextResponse.json({ id: row.id, status: "queued", message: "Queued for Spark. Equipment changes depend on controller mode and verified readback." }, { status: 202 });
}
