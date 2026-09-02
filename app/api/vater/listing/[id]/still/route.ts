/**
 * GET /api/vater/listing/[id]/still
 *
 * Permanent listing-card still. Copies the staged still (or one frame)
 * once, then serves the same path forever.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadOwnedJob, loginRequired } from "@/lib/vater/listing/store";
import { PERMANENT_STILL_CACHE_CONTROL } from "@/lib/vater/permanent-still";
import { ensurePermanentStill } from "@/lib/vater/permanent-still-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;

  const still = await ensurePermanentStill("listing", id);
  if (!still) {
    return NextResponse.json({ error: "Still not available" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(still.bytes), {
    status: 200,
    headers: {
      "Content-Type": still.contentType || "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": PERMANENT_STILL_CACHE_CONTROL,
    },
  });
}
