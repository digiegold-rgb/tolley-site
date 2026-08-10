/**
 * /api/vater/course/clips — the Course Studio Clip Library.
 *
 * GET → { clips: [{ url, name, sceneIdx, variant, current, sizeBytes, sourceProject }] }
 *
 * Lists everything under the `vater-clips/` Blob prefix. Clips land there
 * when a render experiment produces takes worth reusing (first batch: the
 * crossover kling/wan re-animate takes from 2026-08-08 — course b-roll).
 * The bare `scene-NNN.mp4` is the take the final shipped with; `-vN` files
 * are superseded alternates.
 *
 * Studio-allowlist only, same as the rest of /api/vater/course.
 */

import { NextResponse } from "next/server";
import { list } from "@vercel/blob";

import { auth } from "@/auth";
import { isVaterStudioEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";

interface ClipRow {
  url: string;
  name: string;
  sceneIdx: number;
  variant: number; // 0 = the take the final used
  current: boolean;
  sizeBytes: number;
  sourceProject: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clips: ClipRow[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "vater-clips/", cursor, limit: 1000 });
    for (const b of page.blobs) {
      // vater-clips/<projectId>/scene-<NNN>[_vN].mp4
      const m = b.pathname.match(
        /^vater-clips\/([^/]+)\/scene-(\d+)(?:_v(\d+))?\.mp4$/,
      );
      if (!m) continue;
      clips.push({
        url: b.url,
        name: b.pathname.split("/").pop() ?? b.pathname,
        sceneIdx: Number(m[2]),
        variant: m[3] ? Number(m[3]) : 0,
        current: !m[3],
        sizeBytes: b.size,
        sourceProject: m[1],
      });
    }
    cursor = page.cursor ?? undefined;
  } while (cursor);

  clips.sort((a, b) => a.sceneIdx - b.sceneIdx || a.variant - b.variant);
  return NextResponse.json({ clips });
}
