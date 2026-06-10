import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// POST /api/demo/claim — public hand-raise from a /demo/[slug] preview page.
// Creates a GrowthTouch (channel=demo, direction=in, status=received) on the
// owning GrowthLead so the claim lands in the /hq queue. No auth: the demo
// pages are public by design; input is length-capped and the lead must exist.

interface ClaimBody {
  slug?: unknown;
  name?: unknown;
  contact?: unknown;
  message?: unknown;
}

function cleanField(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = cleanField(body.slug, 120);
  const name = cleanField(body.name, 120);
  const contact = cleanField(body.contact, 200);
  const message = cleanField(body.message, 2000);

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid demo slug" }, { status: 400 });
  }
  if (!contact) {
    return NextResponse.json(
      { error: "A phone number or email is required" },
      { status: 400 }
    );
  }

  try {
    const lead = await prisma.growthLead.findFirst({
      where: { demoUrl: `/demo/${slug}` },
      select: { id: true, name: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Demo not found" }, { status: 404 });
    }

    const bodyLines = [
      `Demo claim from /demo/${slug}`,
      `Name: ${name || "(not given)"}`,
      `Contact: ${contact}`,
      message ? `Message: ${message}` : null,
    ].filter(Boolean);

    await prisma.growthTouch.create({
      data: {
        leadId: lead.id,
        channel: "demo",
        direction: "in",
        status: "received",
        subject: `Demo claim — ${lead.name}`,
        body: bodyLines.join("\n"),
        meta: { slug, name, contact },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[demo/claim POST]", err);
    return NextResponse.json(
      { error: "Failed to record your claim — call or text instead" },
      { status: 500 }
    );
  }
}
