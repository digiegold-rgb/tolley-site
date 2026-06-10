import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { HQ_TOUCH_STATUSES } from "@/lib/hq";

export const runtime = "nodejs";

// GET /api/hq/touches?status=draft (default) | approved | sent | received |
// discarded | all — approval-queue data with the owning lead riding along.
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = new URL(request.url).searchParams.get("status") || "draft";
  if (status !== "all" && !(HQ_TOUCH_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const where = status === "all" ? {} : { status };

  try {
    const touches = await prisma.growthTouch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            offer: true,
            city: true,
            email: true,
            phone: true,
            stage: true,
          },
        },
      },
    });

    return NextResponse.json({ touches });
  } catch (err) {
    console.error("[hq/touches GET]", err);
    return NextResponse.json({ error: "Failed to load touches" }, { status: 500 });
  }
}
