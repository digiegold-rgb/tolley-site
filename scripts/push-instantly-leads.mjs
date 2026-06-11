// Push VIDEO-offer leads (stage=demo_built, has email) into the Instantly.ai
// sending campaign, then mark them stage=contacted with a GrowthTouch.
//
// Usage (from tolley-site/):
//   node --env-file=.env.local scripts/push-instantly-leads.mjs [--dry-run] [--limit N]
//
// Env: INSTANTLY_API_KEY + INSTANTLY_CAMPAIGN_VIDEO (campaign UUID).
//
// Idempotent: a lead that already has a GrowthTouch with meta.instantly=true
// is never pushed again. The Instantly request shape mirrors lib/instantly.ts
// (plain-node script can't import the TS adapter) — if the API shape changes,
// fix BOTH files.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? parseInt(process.argv[i + 1], 10) : d; };
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = arg("--limit", 50);
if (!Number.isInteger(LIMIT) || LIMIT < 1 || LIMIT > 500) {
  throw new Error(`--limit must be an integer 1-500, got "${LIMIT}"`);
}

const API_KEY = process.env.INSTANTLY_API_KEY;
const CAMPAIGN = process.env.INSTANTLY_CAMPAIGN_VIDEO;
if (!API_KEY) throw new Error("INSTANTLY_API_KEY not set (run with node --env-file=.env.local)");
if (!CAMPAIGN) throw new Error("INSTANTLY_CAMPAIGN_VIDEO not set — the Instantly campaign UUID for the video offer");

const BASE = "https://api.instantly.ai/api/v2";

/** POST /leads — same shape as lib/instantly.ts addLeadsToCampaign. Throws on failure. */
async function pushLead(lead, customVariables) {
  const res = await fetch(`${BASE}/leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      campaign: CAMPAIGN,
      email: lead.email,
      ...(lead.ownerName ? { first_name: lead.ownerName.split(" ")[0] } : {}),
      company_name: lead.name,
      custom_variables: customVariables,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Instantly POST /leads ${res.status} for ${lead.email}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const leads = await prisma.growthLead.findMany({
  where: { offer: "video", stage: "demo_built", email: { not: null } },
  orderBy: { score: "desc" },
  take: LIMIT,
});

let pushed = 0, skippedAlready = 0, skippedNoVideo = 0, failed = 0;

for (const lead of leads) {
  // Idempotency: already pushed to Instantly?
  const exists = await prisma.growthTouch.findFirst({
    where: { leadId: lead.id, channel: "email", meta: { path: ["instantly"], equals: true } },
    select: { id: true },
  });
  if (exists) { skippedAlready++; continue; }

  if (!lead.videoUrl) {
    console.warn(`⚠ ${lead.name} (${lead.email}) is demo_built but has no videoUrl — run generate-lead-videos first, skipping`);
    skippedNoVideo++;
    continue;
  }

  const customVariables = {
    videoUrl: `https://www.tolley.io${lead.videoUrl}`,
    city: lead.city || "your area",
    category: lead.category || "local business",
    business: lead.name,
  };

  if (DRY_RUN) {
    console.log(`[dry-run] would push ${lead.name} <${lead.email}> → campaign ${CAMPAIGN} (${customVariables.videoUrl})`);
    pushed++;
    continue;
  }

  try {
    await pushLead(lead, customVariables);
  } catch (err) {
    // Per-lead failure must not kill the batch, but it MUST be loud.
    console.error(`✗ push failed for ${lead.name} <${lead.email}>:`, err.message || err);
    failed++;
    continue;
  }

  await prisma.$transaction([
    prisma.growthTouch.create({
      data: {
        leadId: lead.id,
        channel: "email",
        direction: "out",
        status: "sent",
        subject: "Pushed to Instantly campaign",
        meta: { instantly: true, campaignId: CAMPAIGN },
      },
    }),
    prisma.growthLead.update({
      where: { id: lead.id },
      data: { stage: "contacted" },
    }),
  ]);
  pushed++;
  console.log(`✓ ${lead.name} <${lead.email}> → Instantly (stage demo_built → contacted)`);
}

console.log("─".repeat(60));
console.log(
  `${DRY_RUN ? "[dry-run] " : ""}pushed: ${pushed} · already in Instantly: ${skippedAlready} · missing videoUrl: ${skippedNoVideo} · failed: ${failed} (of ${leads.length} candidates)`
);
if (failed > 0) process.exitCode = 1;
await prisma.$disconnect();
