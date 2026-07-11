/**
 * POST /api/sales/provision — the wow.
 *
 * Called by the Work Order form immediately AFTER /api/lead/action succeeds.
 * Slugs the business name, creates a pending Operator + a published (but
 * selling-disabled) Storefront, and returns the /biz/<slug> URL so the form
 * can redirect the person straight to their brand-new site.
 *
 * Public by design (same trust model as /api/lead/action): the operator hasn't
 * signed in yet — they're claiming an account next. Nothing here can charge a
 * card or flip selling on. Jared approves before Buy buttons unlock.
 */
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";
import { themeForKey } from "@/lib/demo-site";
import {
  slugify,
  parseOfferings,
  type Offering,
} from "@/lib/launchpad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProvisionBody {
  receiptToken?: unknown;
  businessName?: unknown;
  category?: unknown;
  city?: unknown;
  phone?: unknown;
  name?: unknown;
  email?: unknown;
  idea?: unknown;
  offerings?: unknown;
}

function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Reserve a unique slug across Storefront + Operator (both are @unique). */
async function uniqueSlug(base: string): Promise<string> {
  const root = base || "storefront";
  for (let n = 0; n < 200; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const [sf, op] = await Promise.all([
      prisma.storefront.findUnique({ where: { slug: candidate }, select: { id: true } }),
      prisma.operator.findUnique({ where: { slug: candidate }, select: { id: true } }),
    ]);
    if (!sf && !op) return candidate;
  }
  // Extremely unlikely fallback — random suffix.
  return `${root}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: NextRequest) {
  let body: ProvisionBody;
  try {
    body = (await request.json()) as ProvisionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const businessName = str(body.businessName, 120);
  if (!businessName) {
    return NextResponse.json(
      { error: "A business name is required to build your site." },
      { status: 400 },
    );
  }

  // Category must be a real theme key; themeForKey falls back to generic.
  const rawCategory = str(body.category, 40);
  const category = themeForKey(rawCategory).key;

  const city = str(body.city, 80) || null;
  const phone = str(body.phone, 40) || null;
  const contactName = str(body.name, 120) || null;
  const email = str(body.email, 160) || null;
  const idea = str(body.idea, 1000);
  const receiptToken = str(body.receiptToken, 64);

  // Offerings: parse what the form sent, else seed a single placeholder from
  // the idea text so every fresh storefront has something to show.
  let offerings: Offering[] = parseOfferings(body.offerings);
  if (offerings.length === 0) {
    offerings = [
      {
        name: idea ? idea.slice(0, 60) : "Get started",
        desc: "Tell Jared what to price this at — he'll set it before your Buy button goes live.",
        priceCents: 0,
        kind: "one_time",
      },
    ];
  }

  // Link back to the intake row if we can find it (best-effort).
  let leadActionId: string | null = null;
  if (receiptToken) {
    const la = await prisma.leadAction
      .findUnique({ where: { receiptToken }, select: { id: true } })
      .catch(() => null);
    leadActionId = la?.id ?? null;
  }

  const slug = await uniqueSlug(slugify(businessName));

  try {
    const operator = await prisma.operator.create({
      data: {
        slug,
        name: contactName || businessName,
        email,
        phone,
        status: "pending",
        leadActionId,
        storefront: {
          create: {
            slug,
            businessName,
            category,
            city,
            phone,
            offerings: offerings as unknown as object,
            published: true,
            sellingEnabled: false,
          },
        },
      },
      select: { id: true, slug: true },
    });

    // Fire-and-forget: queue a draft FB announcement in /social. Draft-only —
    // nothing posts until Jared clicks "Post now". Must never fail provisioning.
    prisma.socialPost
      .create({
        data: {
          source: "launchpad",
          sourceRefId: operator.slug,
          mediaUrl: `https://www.tolley.io/biz/${operator.slug}/opengraph-image`,
          mediaType: "image",
          title: `New on The Launchpad: ${businessName}`,
          caption:
            `${businessName}${city ? ` (${city})` : ""} just launched on The Launchpad.\n\n` +
            `Check it out → https://www.tolley.io/biz/${operator.slug}\n\n` +
            `Want your own? https://www.tolley.io/sales`,
          hashtags: ["#launchpad", "#smallbusiness", "#kansascity"],
          platforms: ["facebook"],
          status: "draft",
        },
      })
      .catch((err) => console.warn("[sales/provision] social draft failed", err));

    // Fire-and-forget: tell Jared a new operator is waiting on the handshake.
    notifyTelegram(
      `🚀 *NEW LAUNCHPAD OPERATOR*: ${businessName}${city ? ` (${city})` : ""}\n` +
        `Preview live → tolley.io/biz/${operator.slug}\n` +
        `${contactName ? `From: ${contactName}` : ""}${phone ? ` · ${phone}` : ""}\n` +
        `Approve at tolley.io/sales/admin`,
    ).catch(() => {});

    return NextResponse.json({
      slug: operator.slug,
      url: `/biz/${operator.slug}`,
    });
  } catch (err) {
    console.error("[sales/provision] create failed", err);
    return NextResponse.json(
      { error: "Couldn't build your site just now — Jared still got your idea." },
      { status: 500 },
    );
  }
}
