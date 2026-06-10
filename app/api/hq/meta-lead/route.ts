/**
 * Meta Lead Ads webhook — Engine 3 receiving end (W/D rental lead forms).
 *
 * Setup (Meta App dashboard → Webhooks → Page → leadgen subscription):
 *   Callback URL : https://tolley.io/api/hq/meta-lead
 *   Verify token : value of META_LEAD_VERIFY_TOKEN in env
 *
 * Flow per lead:
 *   1. Meta POSTs { entry: [{ changes: [{ field: "leadgen", value: { leadgen_id, ... } }] }] }
 *   2. If a page token is available (META_PAGE_TOKEN, falling back to the
 *      existing FACEBOOK_PAGE_TOKEN_WD from the social integration), fetch the
 *      full lead (name/phone/email) from the Graph API.
 *   3. Create a GrowthLead (offer="wd", source="meta-ads", stage="scraped")
 *      plus a draft SMS GrowthTouch so it lands in the /hq approval queue.
 *   4. No token / fetch failure → still create the GrowthLead with the raw
 *      payload in notes. A lead is NEVER dropped silently.
 *
 * Meta requires a fast 200 — only the single Graph lead fetch is awaited.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_VERSION = process.env.FACEBOOK_API_VERSION || "v18.0";

function pageToken(): string | null {
  return process.env.META_PAGE_TOKEN || process.env.FACEBOOK_PAGE_TOKEN_WD || null;
}

// ─── GET — Meta's hub.challenge verification handshake ───
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const expected = process.env.META_LEAD_VERIFY_TOKEN;
  if (!expected) {
    console.error("[hq/meta-lead GET] META_LEAD_VERIFY_TOKEN is not set — cannot verify webhook");
    return NextResponse.json({ error: "Verify token not configured" }, { status: 500 });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("[hq/meta-lead GET] verification failed", { mode, tokenMatch: token === expected });
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

// ─── Graph API lead payload ───

interface LeadFieldData {
  name: string;
  values?: string[];
}

interface GraphLead {
  id: string;
  created_time?: string;
  ad_id?: string;
  ad_name?: string;
  form_id?: string;
  campaign_name?: string;
  field_data?: LeadFieldData[];
}

function fieldValue(lead: GraphLead, ...names: string[]): string | null {
  for (const n of names) {
    const f = lead.field_data?.find((d) => d.name === n);
    const v = f?.values?.[0]?.trim();
    if (v) return v;
  }
  return null;
}

async function fetchLeadFromGraph(leadgenId: string, token: string): Promise<GraphLead> {
  const url =
    `https://graph.facebook.com/${API_VERSION}/${leadgenId}` +
    `?fields=id,created_time,ad_id,ad_name,form_id,campaign_name,field_data` +
    `&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return (await res.json()) as GraphLead;
}

function firstNameOf(lead: GraphLead): string | null {
  const explicit = fieldValue(lead, "first_name");
  if (explicit) return explicit;
  const full = fieldValue(lead, "full_name", "name");
  return full ? full.split(/\s+/)[0] : null;
}

function smsDraftBody(firstName: string | null): string {
  const hi = firstName ? `Hi ${firstName}!` : "Hi!";
  return (
    `${hi} This is Tolley Rentals — thanks for your interest in our washer/dryer rentals. ` +
    `We deliver, install, and handle all repairs for one flat monthly rate, no credit check. ` +
    `Want me to check delivery availability for your address this week? Just reply here. 🙂`
  );
}

interface LeadgenChange {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  created_time?: number;
}

/**
 * Process one leadgen entry: fetch full lead if possible, then create
 * GrowthLead (+ draft SMS GrowthTouch when we have a phone). Falls back to a
 * raw-payload lead so nothing is ever dropped.
 */
async function processLeadgen(value: LeadgenChange): Promise<void> {
  const leadgenId = value.leadgen_id;
  if (!leadgenId) {
    console.error("[hq/meta-lead] leadgen change without leadgen_id:", JSON.stringify(value));
    return;
  }

  // Dedupe — Meta retries webhook deliveries; the leadgen id is recorded in
  // notes on every path below.
  const existing = await prisma.growthLead.findFirst({
    where: { source: "meta-ads", notes: { contains: `leadgen:${leadgenId}` } },
    select: { id: true },
  });
  if (existing) {
    console.log(`[hq/meta-lead] duplicate delivery for leadgen ${leadgenId} — skipping`);
    return;
  }

  const token = pageToken();

  if (!token) {
    // No token configured — keep the raw payload for manual processing.
    console.error(
      `[hq/meta-lead] NO PAGE TOKEN (META_PAGE_TOKEN / FACEBOOK_PAGE_TOKEN_WD) — ` +
        `storing raw payload for leadgen ${leadgenId}. Raw: ${JSON.stringify(value)}`
    );
    await prisma.growthLead.create({
      data: {
        name: `Meta lead ${leadgenId} (unfetched)`,
        offer: "wd",
        source: "meta-ads",
        stage: "scraped",
        notes:
          `leadgen:${leadgenId}\n` +
          `NO PAGE TOKEN at webhook time — fetch manually via Graph API.\n` +
          `Raw payload: ${JSON.stringify(value)}`,
      },
    });
    return;
  }

  let lead: GraphLead;
  try {
    lead = await fetchLeadFromGraph(leadgenId, token);
  } catch (err) {
    // Fetch failed — never drop the lead; store raw payload loudly.
    console.error(
      `[hq/meta-lead] Graph fetch FAILED for leadgen ${leadgenId}: ` +
        `${err instanceof Error ? err.message : String(err)}. Raw: ${JSON.stringify(value)}`
    );
    await prisma.growthLead.create({
      data: {
        name: `Meta lead ${leadgenId} (fetch failed)`,
        offer: "wd",
        source: "meta-ads",
        stage: "scraped",
        notes:
          `leadgen:${leadgenId}\n` +
          `Graph fetch failed: ${err instanceof Error ? err.message : String(err)}\n` +
          `Raw payload: ${JSON.stringify(value)}`,
      },
    });
    return;
  }

  const fullName = fieldValue(lead, "full_name", "name");
  const firstName = firstNameOf(lead);
  const phone = fieldValue(lead, "phone_number", "phone");
  const email = fieldValue(lead, "email");
  const city = fieldValue(lead, "city");

  const noteLines = [
    `leadgen:${leadgenId}`,
    `Meta Lead Ad submission${lead.created_time ? ` at ${lead.created_time}` : ""}`,
    lead.campaign_name ? `Campaign: ${lead.campaign_name}` : null,
    lead.ad_name || lead.ad_id ? `Ad: ${lead.ad_name || lead.ad_id}` : null,
    lead.form_id ? `Form: ${lead.form_id}` : null,
  ].filter(Boolean);

  const created = await prisma.growthLead.create({
    data: {
      name: fullName || firstName || `Meta lead ${leadgenId}`,
      offer: "wd",
      source: "meta-ads",
      stage: "scraped",
      phone,
      email,
      city,
      notes: noteLines.join("\n"),
      touches: {
        create: {
          channel: "sms",
          direction: "out",
          status: "draft",
          body: smsDraftBody(firstName),
          meta: { leadgenId, adId: lead.ad_id ?? value.ad_id ?? null, formId: lead.form_id ?? value.form_id ?? null },
        },
      },
    },
  });

  console.log(
    `[hq/meta-lead] created GrowthLead ${created.id} (+ draft SMS) for leadgen ${leadgenId}` +
      `${phone ? "" : " — NOTE: no phone on lead, draft SMS has no destination"}`
  );
}

// ─── POST — leadgen webhook events ───
export async function POST(request: NextRequest) {
  let body: { object?: string; entry?: Array<{ changes?: Array<{ field?: string; value?: LeadgenChange }> }> };
  try {
    body = await request.json();
  } catch (err) {
    console.error("[hq/meta-lead POST] unparseable body:", err);
    return NextResponse.json({ status: "ok" }); // 200 so Meta doesn't disable the subscription
  }

  try {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "leadgen" || !change.value) continue;
        await processLeadgen(change.value);
      }
    }
  } catch (err) {
    // Log the FULL payload so a failed lead is recoverable from logs.
    console.error(
      `[hq/meta-lead POST] processing FAILED — lead may need manual recovery. ` +
        `Error: ${err instanceof Error ? err.message : String(err)}. ` +
        `Payload: ${JSON.stringify(body)}`
    );
  }

  return NextResponse.json({ status: "ok" });
}
