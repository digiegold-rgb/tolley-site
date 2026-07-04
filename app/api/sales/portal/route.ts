/**
 * PATCH /api/sales/portal — an operator edits their own storefront copy.
 *
 * Session-required + ownership-checked: the storefront's Operator.userId must
 * match the signed-in user, else 404 (don't leak which slugs exist). Operators
 * can edit tagline/about/city/phone and their offerings. They CANNOT flip
 * sellingEnabled — that's Jared's kill-switch, admin-only.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseOfferings } from "@/lib/launchpad";

export const runtime = "nodejs";

interface PatchBody {
  slug?: unknown;
  tagline?: unknown;
  about?: unknown;
  city?: unknown;
  phone?: unknown;
  offerings?: unknown;
}

function optStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined) return undefined; // not provided → leave unchanged
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().slice(0, 80) : "";
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  // Ownership check via the operator relation.
  const storefront = await prisma.storefront.findUnique({
    where: { slug },
    select: { id: true, operator: { select: { userId: true } } },
  });
  if (!storefront || storefront.operator.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    tagline?: string | null;
    about?: string | null;
    city?: string | null;
    phone?: string | null;
    offerings?: object;
  } = {};

  const tagline = optStr(body.tagline, 200);
  if (tagline !== undefined) data.tagline = tagline;
  const about = optStr(body.about, 2000);
  if (about !== undefined) data.about = about;
  const city = optStr(body.city, 80);
  if (city !== undefined) data.city = city;
  const phone = optStr(body.phone, 40);
  if (phone !== undefined) data.phone = phone;

  if (body.offerings !== undefined) {
    data.offerings = parseOfferings(body.offerings) as unknown as object;
  }

  const updated = await prisma.storefront.update({
    where: { id: storefront.id },
    data,
    select: {
      slug: true,
      tagline: true,
      about: true,
      city: true,
      phone: true,
      offerings: true,
    },
  });

  return NextResponse.json({ ok: true, storefront: updated });
}
