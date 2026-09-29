import { NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
import { growthReport } from "@/lib/growth/report";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await growthReport(new URL(req.url).searchParams.get("period") || "today"), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: Request) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || !["blogPaused", "announcementsPaused"].includes(b.control) || typeof b.paused !== "boolean") return NextResponse.json({ error: "Invalid control" }, { status: 400 });
  const update = { [b.control]: b.paused };
  await prisma.growthAutomation.upsert({ where: { id: "owner" }, create: update, update });
  return NextResponse.json({ ok: true });
}
