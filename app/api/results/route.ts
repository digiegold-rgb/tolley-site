import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSavedResultPayload } from "@/lib/saved-results";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { errors, payload } = parseSavedResultPayload(body);
    if (errors.length || !payload) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const savedResult = await prisma.savedResult.create({
      data: {
        userId,
        query: payload.query,
        title: payload.title,
        contentJson: payload.contentJson,
        contentText: payload.contentText,
      },
      select: {
        id: true,
        title: true,
        query: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ savedResult }, { status: 201 });
  } catch (error) {
    console.error("create saved result error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
