/**
 * POST /api/vater/roster/[slug] — edit a canon cast member.
 *
 * Canon was file-only until now: the descriptors ARE the spec, and the spec
 * was edited over SSH. That left the studio read-only on the one thing the
 * owner most wants to change, so "give him green hair for a day" meant a
 * terminal. This writes the same files the renderer reads (the DGX snapshots
 * the previous version next to each one), then mirrors the new descriptor
 * onto the YouTubeCharacter row so a SITE-kicked render — which snapshots the
 * DB, not the file — can't fall behind. Those two drifting apart is exactly
 * how Jeff ended up "sturdy" in one path and "trim and fit" in the other.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import { dgxCall } from "@/lib/vater/dgx-feature-proxy";
import { LOCKED_STYLE_NAME } from "@/lib/vater/locked-style";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;
  if (!isVaterAdminEmail(email) && !isVaterStudioEmail(email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  let body: { descriptor?: string; wardrobe?: { outfits?: string[]; rule?: string } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await dgxCall<{
    ok: boolean;
    name: string;
    slug: string;
    written: string[];
    backupStamp: string;
    notes: string[];
  }>("POST", `/vater/roster/${encodeURIComponent(slug)}`, body, 30_000);

  if (result.kind === "unavailable") {
    return NextResponse.json(
      { error: "The render box isn't reachable — nothing was changed." },
      { status: 503 },
    );
  }
  if (result.kind === "error") {
    let detail = result.body.slice(0, 400);
    try {
      const parsed = JSON.parse(result.body) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      /* keep the raw body */
    }
    return NextResponse.json({ error: detail }, { status: result.status === 400 ? 400 : 502 });
  }

  // Mirror onto the DB row so site-kicked renders use the same identity.
  let dbSynced = false;
  const descriptor = body.descriptor?.trim();
  if (descriptor && descriptor.length >= 50) {
    try {
      const style = await prisma.youTubeStyle.findFirst({
        where: { name: LOCKED_STYLE_NAME },
        select: { id: true },
      });
      if (style) {
        const row = await prisma.youTubeCharacter.findFirst({
          where: { styleId: style.id, name: result.data.name },
          select: { id: true },
        });
        if (row) {
          await prisma.youTubeCharacter.update({
            where: { id: row.id },
            data: { description: descriptor },
          });
          dbSynced = true;
        }
      }
    } catch {
      /* the file IS canon — a DB mirror failure must not fail the edit */
    }
  }

  return NextResponse.json({ ...result.data, dbSynced });
}
