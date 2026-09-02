/**
 * GET /api/vater/youtube/[id]/still
 *
 * Permanent card still. Same path every load. Bytes are copied once from a
 * scene still / existing thumb / one ffmpeg frame, then cached immutable.
 * Does not call the paid SDXL thumbnail generator.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { checkProjectAccess } from "@/lib/vater/project-access";
import { PERMANENT_STILL_CACHE_CONTROL } from "@/lib/vater/permanent-still";
import { ensurePermanentStill } from "@/lib/vater/permanent-still-persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const still = await ensurePermanentStill("youtube", id);
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
