// Outbound cold-email preflight. Tells you EXACTLY what's missing before the
// growth machine can send its queued demos, and live-tests the Instantly key.
//
// Usage (from tolley-site/):
//   node --env-file=.env.local scripts/outbound-preflight.mjs
//
// It also loads ~/.config/growth.env (where the sender reads its keys), so it
// reflects the real send path, not just the site env.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Merge ~/.config/growth.env (the sender's env) over process.env without
// clobbering anything already set.
const GROWTH_ENV = path.join(os.homedir(), ".config", "growth.env");
if (fs.existsSync(GROWTH_ENV)) {
  for (const line of fs.readFileSync(GROWTH_ENV, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const has = (k) => Boolean(process.env[k] && process.env[k].trim());

// name, required?, human note
const CHECKS = [
  ["INSTANTLY_API_KEY", true, "Instantly.ai API key — sends the cold emails"],
  ["APOLLO_API_KEY", true, "Apollo.io key — enriches scraped leads with emails"],
  ["SYNC_SECRET", true, "Shared secret for the direct-send path (already set in prod)"],
  ["INSTANTLY_CAMPAIGN_SITE", false, "Instantly campaign UUID for the 'site' offer ($500+$49/mo demos)"],
  ["INSTANTLY_CAMPAIGN_VIDEO", false, "Campaign UUID for the 'video' offer"],
  ["INSTANTLY_CAMPAIGN_AUTOMATION", false, "Campaign UUID for the 'automation' offer"],
  ["INSTANTLY_CAMPAIGN_DELIVERY", false, "Campaign UUID for the 'delivery' offer"],
];

console.log("\n  Outbound cold-email preflight");
console.log("  ─────────────────────────────\n");

let missingRequired = 0;
for (const [key, required, note] of CHECKS) {
  const ok = has(key);
  if (!ok && required) missingRequired++;
  const mark = ok ? "✅" : required ? "❌" : "⚠️ ";
  const tag = required ? "" : " (optional)";
  console.log(`  ${mark} ${key}${tag}`);
  if (!ok) console.log(`        ↳ ${note}`);
}

// A campaign must exist for at least one offer, else approved emails send nothing.
const anyCampaign = CHECKS.filter(([k]) => k.startsWith("INSTANTLY_CAMPAIGN_")).some(([k]) => has(k));
console.log(
  `\n  ${anyCampaign ? "✅" : "❌"} At least one INSTANTLY_CAMPAIGN_* configured` +
    (anyCampaign ? "" : "  ↳ without one, approved emails silently send nothing"),
);
if (!anyCampaign) missingRequired++;

// Live auth test against Instantly if the key is present.
async function testInstantly() {
  if (!has("INSTANTLY_API_KEY")) {
    console.log("\n  ⏭  Skipping live Instantly test (no key yet).");
    return;
  }
  console.log("\n  Testing Instantly key against the live API…");
  try {
    const res = await fetch("https://api.instantly.ai/api/v2/campaigns?limit=20", {
      headers: { Authorization: `Bearer ${process.env.INSTANTLY_API_KEY}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`  ❌ Instantly returned ${res.status}: ${text.slice(0, 160)}`);
      missingRequired++;
      return;
    }
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    const items = data?.items ?? data?.data ?? (Array.isArray(data) ? data : []);
    console.log(`  ✅ Key works. ${items.length} campaign(s) visible:`);
    for (const c of items.slice(0, 20)) {
      console.log(`        ${c.id ?? c.campaign_id ?? "?"}  ${c.name ?? ""}`);
    }
    console.log("     ↳ copy the right UUID into each INSTANTLY_CAMPAIGN_<OFFER>.");
  } catch (err) {
    console.log(`  ❌ Could not reach Instantly: ${err.message}`);
    missingRequired++;
  }
}

await testInstantly();

console.log("\n  ─────────────────────────────");
if (missingRequired === 0) {
  console.log("  🟢 READY — the machine can send. Fire the queue with the command in");
  console.log("     ~/business-os/OUTBOUND-TURNKEY.md (step 3).\n");
  process.exit(0);
} else {
  console.log(`  🔴 BLOCKED — ${missingRequired} item(s) above. See ~/business-os/OUTBOUND-TURNKEY.md`);
  console.log("     for the exact signups + copy-paste commands.\n");
  process.exit(1);
}
