import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Private haul appraisals — inbound FB photo messages appraised by the DGX
// fb-haul-appraiser service. Events land as SiteEvent rows (site "hq",
// event "haul_appraisal") — no dedicated table needed. POST = DGX service
// (x-sync-secret), GET = Jared's /hq Hauls tab (PIN cookie). Never public.

interface HaulItem {
  name: string;
  photoIndexes: number[];
  condition: string;
  valueLow: number;
  valueHigh: number;
  confidence: number;
  notes: string;
}

interface HaulAppraisalBody {
  pageId: string;
  pageName: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  receivedAt: string;
  messageIds: string[];
  photoUrls: Array<string | null>;
  items: HaulItem[];
  totals: { low: number; high: number; itemCount: number; photoCount: number };
  standouts: string[];
  summary: string;
  comps: Array<{ query: string; medianPrice: number; priceLow?: number; priceHigh?: number; note?: string }>;
  senderText?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret");
  if (!secret || !secretEquals(secret, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as HaulAppraisalBody;
  if (!body?.pageId || !body?.senderId || !Array.isArray(body.photoUrls)) {
    return NextResponse.json({ error: "pageId, senderId, photoUrls required" }, { status: 400 });
  }
  // Idempotent per haul: a re-run of the DGX appraiser (retry, state reset)
  // replaces the existing report instead of duplicating the card.
  const existing = body.conversationId && body.receivedAt
    ? await prisma.siteEvent.findFirst({
        where: {
          event: "haul_appraisal",
          AND: [
            { meta: { path: ["conversationId"], equals: body.conversationId } },
            { meta: { path: ["receivedAt"], equals: body.receivedAt } },
          ],
        },
        select: { id: true },
      })
    : null;
  const data = {
      site: "hq",
      path: "/hq?tab=hauls",
      event: "haul_appraisal",
      label: `${body.pageName ?? body.pageId} · ${body.senderName ?? body.senderId}`.slice(0, 80),
      meta: {
        pageId: body.pageId,
        pageName: (body.pageName ?? "").slice(0, 80),
        conversationId: body.conversationId ?? null,
        senderId: body.senderId,
        senderName: (body.senderName ?? "").slice(0, 80),
        receivedAt: body.receivedAt ?? null,
        messageIds: (body.messageIds ?? []).slice(0, 10),
        photoUrls: body.photoUrls.slice(0, 40),
        items: (body.items ?? []).slice(0, 60).map((it) => ({
          name: String(it.name ?? "").slice(0, 120),
          photoIndexes: (it.photoIndexes ?? []).slice(0, 30),
          condition: String(it.condition ?? "good").slice(0, 20),
          valueLow: Number(it.valueLow) || 0,
          valueHigh: Number(it.valueHigh) || 0,
          confidence: Number(it.confidence) || 0,
          notes: String(it.notes ?? "").slice(0, 200),
        })),
        totals: body.totals ?? null,
        standouts: (body.standouts ?? []).slice(0, 3),
        summary: (body.summary ?? "").slice(0, 400),
        comps: (body.comps ?? []).slice(0, 5),
        senderText: (body.senderText ?? "").slice(0, 500),
        error: body.error?.slice(0, 400) ?? null,
      },
  };
  const row = existing
    ? await prisma.siteEvent.update({ where: { id: existing.id }, data })
    : await prisma.siteEvent.create({ data });
  return NextResponse.json({ ok: true, id: row.id, updated: !!existing });
}

export async function GET(req: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30), 50);
  const rows = await prisma.siteEvent.findMany({
    where: { event: "haul_appraisal" },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, label: true, meta: true, createdAt: true },
  });
  return NextResponse.json({
    hauls: rows.map((r) => ({ id: r.id, label: r.label, at: r.createdAt, ...(r.meta as object) })),
  });
}
