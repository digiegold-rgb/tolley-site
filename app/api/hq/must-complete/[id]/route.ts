import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

const STATUSES = new Set(["open", "done", "dismissed"]);

// PATCH /api/hq/must-complete/[id] — status flips (done/undo/dismiss) + edits.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.status === "string") {
    if (!STATUSES.has(body.status)) {
      return NextResponse.json({ error: "Bad status" }, { status: 400 });
    }
    data.status = body.status;
    data.completedAt = body.status === "open" ? null : new Date();
  }
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    data.sortOrder = body.sortOrder;
  }
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body.detail === "string") data.detail = body.detail.trim() || null;
  if (typeof body.afterNote === "string") data.afterNote = body.afterNote.trim() || null;
  if (typeof body.command === "string") data.command = body.command.trim() || null;
  if (typeof body.priority === "string" && ["red", "yellow", "green"].includes(body.priority)) {
    data.priority = body.priority;
  }
  if (typeof body.category === "string" && body.category.trim()) data.category = body.category.trim();
  if (Array.isArray(body.links)) {
    data.links = body.links
      .filter(
        (l): l is { label: string; url: string } =>
          !!l &&
          typeof l === "object" &&
          typeof (l as { label?: unknown }).label === "string" &&
          typeof (l as { url?: unknown }).url === "string" &&
          /^(https?:|tel:|mailto:)/.test((l as { url: string }).url),
      )
      .map((l) => ({ label: l.label.slice(0, 120), url: l.url }));
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    const item = await prisma.mustCompleteItem.update({ where: { id }, data });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error("[hq/must-complete PATCH]", err);
    return NextResponse.json({ error: "Update failed (bad id?)" }, { status: 500 });
  }
}
