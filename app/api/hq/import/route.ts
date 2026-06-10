import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { HQ_OFFERS, sanitizeGrowthLeadInput } from "@/lib/hq";

export const runtime = "nodejs";

// POST /api/hq/import — bulk-import scraped prospects.
// Body: JSON array of GrowthLead scalar-field objects (or { leads: [...] }).
// Upsert key: placeId; fallback name+city. New rows land at stage="scraped";
// existing rows get their scraped fields refreshed but stage is never reset.
export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { leads?: unknown[] }).leads)
      ? (payload as { leads: unknown[] }).leads
      : null;

  if (!items) {
    return NextResponse.json(
      { error: "Expected a JSON array of prospects (or { leads: [...] })" },
      { status: 400 }
    );
  }
  if (items.length === 0) {
    return NextResponse.json({ created: 0, updated: 0, skipped: 0, errors: [] });
  }
  if (items.length > 500) {
    return NextResponse.json({ error: "Max 500 prospects per import" }, { status: 400 });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index, raw] of items.entries()) {
    if (!raw || typeof raw !== "object") {
      skipped++;
      errors.push(`#${index}: not an object`);
      continue;
    }

    const input = sanitizeGrowthLeadInput(raw as Record<string, unknown>);

    if (!input.name) {
      skipped++;
      errors.push(`#${index}: missing name`);
      continue;
    }
    if (!input.offer || !(HQ_OFFERS as readonly string[]).includes(input.offer)) {
      skipped++;
      errors.push(`#${index} (${input.name}): offer must be one of ${HQ_OFFERS.join("|")}`);
      continue;
    }

    // Imports always enter the pipeline at "scraped"; never let the payload
    // move an existing lead's stage.
    delete input.stage;

    try {
      const existing = input.placeId
        ? await prisma.growthLead.findUnique({ where: { placeId: input.placeId } })
        : await prisma.growthLead.findFirst({
            where: { name: input.name, city: input.city ?? null },
          });

      if (existing) {
        await prisma.growthLead.update({ where: { id: existing.id }, data: input });
        updated++;
      } else {
        await prisma.growthLead.create({
          data: { ...input, name: input.name, offer: input.offer, stage: "scraped" },
        });
        created++;
      }
    } catch (err) {
      console.error(`[hq/import] row ${index} (${input.name})`, err);
      skipped++;
      errors.push(`#${index} (${input.name}): db error`);
    }
  }

  return NextResponse.json({ created, updated, skipped, errors });
}
