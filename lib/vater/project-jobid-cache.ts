/**
 * Cached lookup of a YouTubeProject's autopilotJobId.
 *
 * The scene/audio/video proxy routes all need the autopilotJobId to
 * construct a DGX file URL. Doing prisma.findUnique on every image fetch
 * means 12+ parallel DB queries per editor page load, which on Neon
 * serverless adds seconds-to-minutes of latency from pool cold-start.
 *
 * autopilotJobId is IMMUTABLE per project (set once by run-creation).
 * So we cache it for 1 hour — first fetch hits DB, remaining 11 parallel
 * fetches resolve from memory in microseconds.
 */
import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Resolve a project's autopilotJobId from just its id. Cached for 1h.
 * Returns null if the project doesn't exist or has no autopilotJobId yet.
 *
 * Callers still enforce auth — cache key is just projectId. The fact
 * that we leak "does this project exist" to cache hits is fine because
 * the proxy routes reject unauthenticated requests before calling this.
 */
export const getProjectJobId = unstable_cache(
  async (projectId: string): Promise<string | null> => {
    const project = await prisma.youTubeProject.findUnique({
      where: { id: projectId },
      select: { autopilotJobId: true },
    });
    return project?.autopilotJobId ?? null;
  },
  ["vater-youtube-project-jobid"],
  {
    // autopilotJobId never changes for a given project → 1h cache.
    revalidate: 3600,
    tags: ["vater-youtube-project"],
  },
);
