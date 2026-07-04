/**
 * POST /api/sales/buyout — an operator requests to buy themselves out.
 *
 * Session-required + ownership-checked. Records a LeadAction (subsite="sales",
 * action="buyout_request") so it lands in Jared's normal lead pipeline + fires
 * the usual notification. Does not move any money or change ownership — it's a
 * request; Jared prices and executes the buyout by hand.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";

export const runtime = "nodejs";

interface Body {
  slug?: unknown;
  reason?: unknown;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email || null;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 80) : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const operator = await prisma.operator.findUnique({
    where: { slug },
    select: { id: true, name: true, phone: true, userId: true, storefront: { select: { businessName: true } } },
  });
  if (!operator || operator.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const receiptToken = crypto.randomBytes(8).toString("base64url");
  await prisma.leadAction.create({
    data: {
      receiptToken,
      subsite: "sales",
      action: "buyout_request",
      email,
      name: operator.name,
      phone: operator.phone,
      structured: {
        operatorSlug: slug,
        businessName: operator.storefront?.businessName ?? operator.name,
        reason: reason || null,
      },
    },
  });

  notifyTelegram(
    `💰 *BUYOUT REQUEST*: ${operator.storefront?.businessName ?? operator.name}\n` +
      `Operator: ${operator.name}${operator.phone ? ` (${operator.phone})` : ""}\n` +
      `${reason ? `"${reason}"\n` : ""}→ tolley.io/biz/${slug}`,
  ).catch(() => {});

  return NextResponse.json({ ok: true, receiptToken });
}
