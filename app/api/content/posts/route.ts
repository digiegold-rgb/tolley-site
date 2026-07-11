import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";

/**
 * GET /api/content/posts — list posts (with filters)
 * POST /api/content/posts — create a draft post
 *
 * Auth: a signed-in admin session (the /animate publishing screen in the
 * browser) OR the `x-sync-secret` header (DGX autopilot). The old `?key=`
 * query-param path was removed — it leaked the shared secret into logs and
 * would have shipped it in the browser bundle via NEXT_PUBLIC_AUTOPILOT_KEY.
 */
async function authorizeRead(req: NextRequest): Promise<boolean> {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret && secretEquals(req.headers.get("x-sync-secret"), syncSecret)) {
    return true;
  }
  const admin = await requireAdminApiSession();
  return admin.ok;
}

export async function GET(req: NextRequest) {
  if (!(await authorizeRead(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriberId = req.nextUrl.searchParams.get("subscriberId");
  const status = req.nextUrl.searchParams.get("status");
  const platform = req.nextUrl.searchParams.get("platform");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

  const where: Record<string, unknown> = {};
  if (subscriberId) where.subscriberId = subscriberId;
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const [posts, total] = await Promise.all([
    prisma.contentPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.contentPost.count({ where }),
  ]);

  return NextResponse.json({ posts, total });
}

export async function POST(req: NextRequest) {
  if (!(await authorizeRead(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    subscriberId,
    platform,
    contentType,
    postBody,
    mediaUrls,
    hashtags,
    templateId,
    listingId,
    clientId,
    dossierJobId,
    campaignId,
    scheduledAt,
  } = body;

  if (!subscriberId || !platform || !postBody) {
    return NextResponse.json(
      { error: "subscriberId, platform, body required" },
      { status: 400 }
    );
  }

  const post = await prisma.contentPost.create({
    data: {
      subscriberId,
      platform,
      contentType: contentType || "text",
      body: postBody,
      mediaUrls: mediaUrls || [],
      hashtags: hashtags || [],
      templateId: templateId || null,
      listingId: listingId || null,
      clientId: clientId || null,
      dossierJobId: dossierJobId || null,
      campaignId: campaignId || null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? "scheduled" : "draft",
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
