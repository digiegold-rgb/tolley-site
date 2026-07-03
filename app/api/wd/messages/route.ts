import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";

/**
 * GET /api/wd/messages — list customer messages for the admin inbox.
 * ?status=draft (default) | sent | received | all
 */
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = new URL(request.url).searchParams.get("status") || "draft";
  const where =
    status === "all" ? {} : status === "draft" ? { status: { in: ["draft", "failed"] } } : { status };

  const messages = await prisma.wdMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { client: { select: { id: true, name: true, phone: true, email: true } } },
  });

  return NextResponse.json({ messages });
}
