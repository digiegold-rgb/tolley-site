import { hasBearer, privateHeaders } from "@/lib/day/auth";
import { isSixCentral } from "@/lib/day/core";
import { refreshSnapshot } from "@/lib/day/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!hasBearer(request, process.env.CRON_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
  // Vercel cron is UTC. 11 UTC in summer / 12 UTC in winter; skip the other hour.
  if (!isSixCentral(new Date())) return Response.json({ skipped: true, reason: "Outside 6 AM Central" }, { headers: privateHeaders });
  try {
    const result = await refreshSnapshot();
    return Response.json({ saved: result.storage === "ready", generatedAt: result.snapshot?.generatedAt,
      sections: Object.fromEntries(Object.entries(result.snapshot?.sections ?? {}).map(([key, value]) => [key, value.status])) },
    { status: result.storage === "ready" ? 200 : 503, headers: privateHeaders });
  } catch {
    return Response.json({ saved: false }, { status: 503, headers: privateHeaders });
  }
}
