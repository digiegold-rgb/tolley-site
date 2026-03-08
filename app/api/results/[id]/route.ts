import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function optionalTrimmedString(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await context.params;
  const savedResult = await prisma.savedResult.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!savedResult) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ savedResult });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.savedResult.findFirst({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
      query: true,
      title: true,
      contentJson: true,
      contentText: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const title = optionalTrimmedString(body.title, 160);
    const query = optionalTrimmedString(body.query, 500);
    const contentText = optionalTrimmedString(body.contentText, 25000);
    const contentJson =
      body.contentJson && typeof body.contentJson === "object"
        ? (body.contentJson as Prisma.InputJsonValue)
        : undefined;

    if (
      title === undefined &&
      query === undefined &&
      contentText === undefined &&
      contentJson === undefined
    ) {
      return NextResponse.json(
        { error: "No editable fields provided." },
        { status: 400 },
      );
    }

    const updated = await prisma.savedResult.update({
      where: { id: existing.id },
      data: {
        title: title || undefined,
        query: query || undefined,
        contentText: contentText || undefined,
        contentJson: contentJson || undefined,
      },
      select: {
        id: true,
        title: true,
        query: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ savedResult: updated });
  } catch (error) {
    console.error("update saved result error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
