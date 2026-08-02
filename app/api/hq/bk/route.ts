import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/secret-compare";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE = "bk";
const MAX_BODY = 2_000_000; // BK payloads carry shot lists + atom excerpts

async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

/** Latest production snapshot pushed from the DGX, plus any HQ-side notes. */
export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [snapshot, notes] = await Promise.all([
    prisma.empireSnapshot.findFirst({
      where: { source: SOURCE },
      orderBy: { createdAt: "desc" },
    }),
    prisma.empireSnapshot.findFirst({
      where: { source: `${SOURCE}-notes` },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({
    production: snapshot?.payload ?? null,
    pushedAt: snapshot?.createdAt ?? null,
    notes: notes?.payload ?? { items: [] },
  });
}

/**
 * POST from the DGX (`bk-status.mjs`, x-sync-secret) writes the production
 * snapshot. POST from the browser with {kind:"notes"} writes Jared's
 * high-level direction notes back for the next render pass to read.
 */
export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const source = body.kind === "notes" ? `${SOURCE}-notes` : SOURCE;
  await prisma.empireSnapshot.create({ data: { source, payload: body as never } });
  // keep 30 days of history so a bad render can be compared against a good one
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.empireSnapshot.deleteMany({
    where: { source, createdAt: { lt: cutoff } },
  });
  return NextResponse.json({ ok: true, source });
}
