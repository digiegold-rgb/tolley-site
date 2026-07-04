/**
 * POST /api/sales/admin — Jared's approve queue actions (admin-only).
 *
 * Body: { slug, action: "approve" | "pause" | "note", note? }
 *   approve → operator.status="approved" + approvedAt + storefront.sellingEnabled=true (Buy unlocks)
 *   pause   → operator.status="paused"   + storefront.sellingEnabled=false (kill-switch)
 *   note    → operator.notes = note
 *
 * Guarded by requireAdminApiSession (ADMIN_ALLOWLIST_EMAILS).
 */
import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";

export const runtime = "nodejs";

interface Body {
  slug?: unknown;
  action?: unknown;
  note?: unknown;
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminApiSession();
  if (!guard.ok) return guard.response;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 80) : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!slug || !["approve", "pause", "note"].includes(action)) {
    return NextResponse.json({ error: "slug and valid action required" }, { status: 400 });
  }

  const operator = await prisma.operator.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true, storefront: { select: { id: true, businessName: true } } },
  });
  if (!operator) {
    return NextResponse.json({ error: "Operator not found" }, { status: 404 });
  }

  if (action === "note") {
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
    await prisma.operator.update({
      where: { id: operator.id },
      data: { notes: note || null },
    });
    return NextResponse.json({ ok: true, status: operator.status });
  }

  if (action === "approve") {
    await prisma.$transaction([
      prisma.operator.update({
        where: { id: operator.id },
        data: { status: "approved", approvedAt: new Date() },
      }),
      ...(operator.storefront
        ? [
            prisma.storefront.update({
              where: { id: operator.storefront.id },
              data: { sellingEnabled: true },
            }),
          ]
        : []),
    ]);
    notifyTelegram(
      `✅ *LAUNCHPAD APPROVED*: ${operator.storefront?.businessName ?? operator.name} — ordering is now LIVE at tolley.io/biz/${slug}`,
    ).catch(() => {});
    return NextResponse.json({ ok: true, status: "approved" });
  }

  // pause
  await prisma.$transaction([
    prisma.operator.update({
      where: { id: operator.id },
      data: { status: "paused" },
    }),
    ...(operator.storefront
      ? [
          prisma.storefront.update({
            where: { id: operator.storefront.id },
            data: { sellingEnabled: false },
          }),
        ]
      : []),
  ]);
  return NextResponse.json({ ok: true, status: "paused" });
}
