import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { applyDailyAction, dailyActionSchema, DailyActionError } from "@/lib/leads/daily-actions";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (session?.mfaRequired) return NextResponse.json({ error: "Complete owner verification first" }, { status: 403 });
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const sub = await prisma.leadSubscriber.findUnique({ where: { userId: session.user.id } });
  if (!sub || sub.status !== "active") return NextResponse.json({ error: "Active workspace required" }, { status: 403 });
  const input = dailyActionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message || "Invalid action" }, { status: 400 });
  try {
    return NextResponse.json(await applyDailyAction(sub.id, isAdminEmail(session.user.email), input.data));
  } catch (error) {
    if (error instanceof DailyActionError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[daily desk] save failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Could not save. Your follow-up is still available; try again." }, { status: 500 });
  }
}
