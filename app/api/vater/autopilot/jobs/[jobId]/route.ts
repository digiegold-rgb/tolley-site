/**
 * GET /api/vater/autopilot/jobs/[jobId]
 *
 * Thin proxy to the DGX autopilot's /vater/jobs/{id} endpoint. Used by
 * Style editor inline jobs (reference transcribe, character gen, custom
 * art style describer) that aren't tied to a specific YouTubeProject.
 *
 * Auth: requires user session — anyone can poll any job id (job ids are
 * unguessable cuids and the proxy doesn't reveal data anyone shouldn't
 * see, but session-gated to keep the surface narrow).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await ctx.params;
  if (!jobId || !/^[a-zA-Z0-9_-]{8,64}$/.test(jobId)) {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }
  try {
    const job = await autopilot.getJob(jobId);
    return NextResponse.json(job);
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Autopilot poll failed", status: err.status, detail: err.body || err.message },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Autopilot unreachable", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
