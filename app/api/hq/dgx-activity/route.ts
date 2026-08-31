import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";
import { readDgxActivity } from "@/lib/hq-posts-read";

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

// GET — the Posts tab reads the current line. Same admin gate as the rest of
// /hq: the line names live infra (ports, engines) and must not be public.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await readDgxActivity());
}
