/**
 * POST /api/demo/intake  — the post-payment onboarding form.
 *
 * After a paid checkout, /demo/<slug>/welcome shows an intake form. This
 * appends the answers to the owning GrowthLead.notes and drops a GrowthTouch
 * (channel="note", direction="in", status="received") so the intake lands in
 * the /hq queue for Cordless to start the build.
 *
 * Public (same posture as /api/demo/claim) — lead resolved by its own
 * demoUrl, fields length-capped, errors surface (no silent catch).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface IntakeBody {
  slug?: unknown;
  hours?: unknown;
  assets?: unknown;
  domain?: unknown;
  notes?: unknown;
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "demo:intake", 5, 3600);
  if (limited) return limited;

  let body: IntakeBody;
  try {
    body = (await request.json()) as IntakeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug = clean(body.slug, 120);
  const hours = clean(body.hours, 1000);
  const assets = clean(body.assets, 2000);
  const domain = clean(body.domain, 300);
  const notes = clean(body.notes, 2000);

  if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: "Invalid demo slug" }, { status: 400 });
  }

  try {
    const lead = await prisma.growthLead.findFirst({
      where: { demoUrl: `/demo/${slug}` },
      select: { id: true, name: true, notes: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Demo not found" }, { status: 404 });
    }

    const stamp = new Date().toISOString();
    const intakeLines = [
      `Business hours: ${hours || "(not given)"}`,
      `Logo / photos: ${assets || "(none provided)"}`,
      `Preferred domain: ${domain || "(none given)"}`,
      `Anything else: ${notes || "(nothing)"}`,
    ];
    const intakeBody = intakeLines.join("\n");

    const noteBlock = [
      `── Site intake (${stamp}) from /demo/${slug} ──`,
      intakeBody,
    ].join("\n");

    await prisma.$transaction([
      prisma.growthLead.update({
        where: { id: lead.id },
        data: {
          notes: lead.notes ? `${lead.notes}\n\n${noteBlock}` : noteBlock,
        },
      }),
      prisma.growthTouch.create({
        data: {
          leadId: lead.id,
          channel: "note",
          direction: "in",
          status: "received",
          subject: `Site intake — ${lead.name}`,
          body: intakeBody,
          meta: { slug, hours, assets, domain, notes },
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[demo/intake POST]", err);
    return NextResponse.json(
      { error: "Couldn't save your details — we'll follow up by phone" },
      { status: 500 }
    );
  }
}
