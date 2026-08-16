/**
 * POST /api/vater/youtube/[id]/thumbnail-variants  { count: 2|3, hints? }
 *   → { variants: [{ url, variant }] }
 *
 * Thin proxy to DGX `POST /vater/projects/{projectId}/thumbnail-variants`.
 * Feeds the A/B compare grid in the Thumbnail step; picking one is a separate
 * PATCH of `thumbnailUrl` on the project, so nothing here mutates the row.
 *
 * The DGX may answer either a bare array (per the contract) or an object with
 * a `variants` key — both are normalised to `{ variants }` for the client.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkProjectAccess } from "@/lib/vater/project-access";
import { dgxCall, unavailableBody } from "@/lib/vater/dgx-feature-proxy";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export interface ThumbnailVariant {
  url: string;
  variant: string;
}

type DgxVariants = ThumbnailVariant[] | { variants?: ThumbnailVariant[] };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  let body: { count?: unknown; hints?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — default to 3 variants.
  }

  const requested = Number(body.count);
  const count = requested === 2 || requested === 3 ? requested : 3;
  const hints = Array.isArray(body.hints)
    ? (body.hints as unknown[]).filter((h): h is string => typeof h === "string")
    : undefined;

  // Title + concept give the DGX something to draw from when the caller
  // sends no hints. Read-only.
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { publishTitle: true, sourceTitle: true, thumbnailConcept: true },
  });

  const dgx = await dgxCall<DgxVariants>(
    "POST",
    `/vater/projects/${encodeURIComponent(id)}/thumbnail-variants`,
    {
      count,
      ...(hints && hints.length ? { hints } : {}),
      ...(project?.publishTitle || project?.sourceTitle
        ? { title: project.publishTitle ?? project.sourceTitle }
        : {}),
      ...(project?.thumbnailConcept ? { concept: project.thumbnailConcept } : {}),
    },
  );

  if (dgx.kind === "unavailable") {
    return NextResponse.json(
      unavailableBody("Thumbnail variants", dgx.reason),
      { status: 501 },
    );
  }
  if (dgx.kind === "error") {
    return NextResponse.json(
      { error: "Variant generation failed", detail: dgx.body.slice(0, 300) },
      { status: 502 },
    );
  }

  const raw = Array.isArray(dgx.data) ? dgx.data : (dgx.data.variants ?? []);
  const variants = raw
    .filter((v): v is ThumbnailVariant => Boolean(v && typeof v.url === "string"))
    .map((v, i) => ({ url: v.url, variant: v.variant || `Variant ${i + 1}` }));

  return NextResponse.json({ variants });
}
