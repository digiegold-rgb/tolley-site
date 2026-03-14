import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  const [generations, total] = await prisma.$transaction([
    prisma.videoGeneration.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        prompt: true,
        model: true,
        tier: true,
        status: true,
        creditsUsed: true,
        outputUrl: true,
        thumbnailUrl: true,
        durationSecs: true,
        resolution: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.videoGeneration.count({ where: { userId: session.user.id } }),
  ]);

  return NextResponse.json({
    generations,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}
