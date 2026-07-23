import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cookie (Jared in /hq) OR x-sync-secret (DGX agents queueing new blockers).
async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

const PRIORITIES = new Set(["red", "yellow", "green"]);

type LinkEntry = { label: string; url: string };

function cleanLinks(raw: unknown): LinkEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is LinkEntry =>
        !!l &&
        typeof l === "object" &&
        typeof (l as LinkEntry).label === "string" &&
        typeof (l as LinkEntry).url === "string" &&
        /^(https?:|tel:|mailto:)/.test((l as LinkEntry).url),
    )
    .map((l) => ({ label: l.label.slice(0, 120), url: l.url }));
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// GET /api/hq/must-complete — open queue (ordered) + recently completed.
export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [open, done] = await Promise.all([
      prisma.mustCompleteItem.findMany({
        where: { status: "open" },
        orderBy: { sortOrder: "asc" },
      }),
      prisma.mustCompleteItem.findMany({
        where: { status: { in: ["done", "dismissed"] } },
        orderBy: { completedAt: "desc" },
        take: 50,
      }),
    ]);
    return NextResponse.json({ open, done });
  } catch (err) {
    console.error("[hq/must-complete GET]", err);
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }
}

// POST /api/hq/must-complete — append a new item (agents use x-sync-secret).
export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = str(body.title);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // Duplicate guard — agents may re-report the same blocker across sessions.
  const existing = await prisma.mustCompleteItem.findFirst({
    where: { title, status: "open" },
  });
  if (existing) return NextResponse.json({ ok: true, item: existing, deduped: true });

  const priority = PRIORITIES.has(String(body.priority)) ? String(body.priority) : "red";
  let sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : NaN;
  if (!Number.isFinite(sortOrder)) {
    const max = await prisma.mustCompleteItem.aggregate({ _max: { sortOrder: true } });
    sortOrder = (max._max.sortOrder ?? 0) + 10;
  }

  try {
    const item = await prisma.mustCompleteItem.create({
      data: {
        sortOrder,
        priority,
        category: str(body.category) ?? "general",
        title,
        detail: str(body.detail),
        links: cleanLinks(body.links),
        command: str(body.command),
        afterNote: str(body.afterNote),
        source: str(body.source) ?? "claude",
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("[hq/must-complete POST]", err);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}
