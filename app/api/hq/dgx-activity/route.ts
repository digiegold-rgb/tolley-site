import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/hq/dgx-activity — the DGX pushes a one-line "what am I working on"
// hourly (dgx-activity-scan.sh, x-sync-secret auth). Single-row upsert.
export async function POST(request: NextRequest) {
  const header = request.headers.get("x-sync-secret");
  if (!header || !secretEquals(header, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const line = typeof (body as { line?: unknown })?.line === "string" ? (body as { line: string }).line.trim().slice(0, 300) : "";
  if (!line) return NextResponse.json({ error: "line required" }, { status: 400 });

  await prisma.dgxActivity.upsert({
    where: { id: 1 },
    create: { id: 1, line },
    update: { line, updatedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

// GET — the Posts tab reads the current line.
export async function GET() {
  const row = await prisma.dgxActivity.findUnique({ where: { id: 1 } });
  if (!row) return NextResponse.json({ line: null, updatedAt: null });
  return NextResponse.json({ line: row.line, updatedAt: row.updatedAt.toISOString() });
}
