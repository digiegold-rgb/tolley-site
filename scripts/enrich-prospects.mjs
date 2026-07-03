// Engine 1 step 2 — Apollo enrichment of GrowthLead prospects.
// Usage (from tolley-site/): node --env-file=.env.local scripts/enrich-prospects.mjs
// Reads APOLLO_API_KEY from ~/.config/growth.env.
//
// Flow per lead (cheapest viable on Apollo):
//   1. GET  /v1/organizations/enrich?domain=        (free, verifies org exists)
//   2. POST /v1/mixed_people/search                  (find owner/decision-maker by title)
//   3. POST /v1/people/match { id }                  (reveal email — consumes 1 credit)
//
// Hits  -> ownerName, email, emailSource="apollo", stage="enriched"
// Miss  -> notes += "apollo: no match <date>" (stage unchanged)
// HARD-STOP on 402 / API_INACCESSIBLE / credit exhaustion / repeated 429 — no false
// "no match" notes are written for plan-gated or rate-limited leads.

import { PrismaClient } from "@prisma/client";
import { readFileSync, mkdirSync, appendFileSync } from "node:fs";

const DATE = new Date().toISOString().slice(0, 10);
const LOG_DIR = "/home/jelly/growth-engine/logs";
const LOG_FILE = `${LOG_DIR}/apollo-enrich-${DATE}.log`;
const MAX_PER_COHORT = 40;
const CALL_GAP_MS = 650;
const TITLES = ["owner", "president", "ceo", "founder", "general manager"];
const TITLE_PRIORITY = ["owner", "founder", "ceo", "chief executive officer", "president", "general manager"];
const BAD_HOST_SUFFIXES = [
  "facebook.com", "wixsite.com", "godaddysites.com", "yelp.com",
  "instagram.com", "linktr.ee", "business.site", "google.com",
  "squarespace.com", "weebly.com", "wordpress.com", "doordash.com",
];

// ---------- env ----------
try {
  const envText = readFileSync("/home/jelly/.config/growth.env", "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch (e) {
  console.error("cannot read growth.env:", e.message);
  process.exit(2);
}
const API_KEY = process.env.APOLLO_API_KEY;
if (!API_KEY) { console.error("APOLLO_API_KEY missing"); process.exit(2); }

mkdirSync(LOG_DIR, { recursive: true });
function log(line) {
  const msg = `${new Date().toISOString()} ${line}`;
  console.log(msg);
  appendFileSync(LOG_FILE, msg + "\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- domain hygiene ----------
function extractDomain(website) {
  if (!website) return null;
  let host;
  try { host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname.toLowerCase(); }
  catch { return null; }
  host = host.replace(/^www\./, "");
  if (!host.includes(".")) return null;
  for (const bad of BAD_HOST_SUFFIXES) {
    if (host === bad || host.endsWith(`.${bad}`)) return null;
  }
  return host;
}

// ---------- Apollo client ----------
class HardStop extends Error {}
let apiCalls = 0;
let creditsUsedHint = null; // from rate-limit/credit headers if Apollo sends them

async function apollo(method, path, body) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    apiCalls++;
    const res = await fetch(`https://api.apollo.io/api/v1${path}`, {
      method,
      headers: { "X-Api-Key": API_KEY, "Content-Type": "application/json", "Cache-Control": "no-cache" },
      body: body ? JSON.stringify(body) : undefined,
    });
    // surface any credit/usage headers Apollo returns
    for (const [k, v] of res.headers.entries()) {
      if (/credit|usage/i.test(k)) creditsUsedHint = `${k}=${v}`;
    }
    if (res.status === 429) {
      if (attempt === 3) throw new HardStop("rate-limited 4x in a row (429) — stopping to be polite");
      const wait = [5000, 15000, 45000][attempt];
      log(`WARN 429 on ${path}, backing off ${wait}ms`);
      await sleep(wait);
      continue;
    }
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    const errStr = JSON.stringify(json).toLowerCase();
    if (res.status === 402 || json?.error_code === "API_INACCESSIBLE" ||
        errStr.includes("insufficient credits") || errStr.includes("upgrade your plan") ||
        errStr.includes("payment required") || errStr.includes("out of credits")) {
      throw new HardStop(`payment/plan gate on ${path}: ${json?.error || text.slice(0, 200)}`);
    }
    if (!res.ok) return { _httpError: res.status, ...json };
    return json;
  }
}

function pickPerson(people) {
  if (!people?.length) return null;
  for (const want of TITLE_PRIORITY) {
    const hit = people.find((p) => (p.title || "").toLowerCase().includes(want));
    if (hit) return hit;
  }
  return people[0];
}

// ---------- enrichment ----------
const prisma = new PrismaClient();
const stats = {
  delivery: { processed: 0, hits: 0, misses: 0, skippedDomain: 0 },
  site: { processed: 0, hits: 0, misses: 0, skippedDomain: 0 },
};
const samples = [];

async function enrichLead(lead, cohort) {
  const domain = extractDomain(lead.website);
  if (!domain) {
    stats[cohort].skippedDomain++;
    log(`SKIP [${cohort}] ${lead.name} — no real domain (${lead.website ?? "null"})`);
    return;
  }
  stats[cohort].processed++;

  // 1. org enrich (free) — confirms Apollo knows the domain
  const orgRes = await apollo("GET", `/organizations/enrich?domain=${encodeURIComponent(domain)}`);
  await sleep(CALL_GAP_MS);
  const org = orgRes?.organization;

  // 2. people search by domain + decision-maker titles
  const searchRes = await apollo("POST", "/mixed_people/search", {
    q_organization_domains_list: [domain],
    person_titles: TITLES,
    page: 1,
    per_page: 10,
  });
  await sleep(CALL_GAP_MS);
  const person = pickPerson(searchRes?.people);

  if (!person) {
    stats[cohort].misses++;
    const note = `apollo: no match ${DATE}`;
    await prisma.growthLead.update({
      where: { id: lead.id },
      data: { notes: lead.notes ? `${lead.notes}\n${note}` : note },
    });
    log(`MISS [${cohort}] ${lead.name} (${domain}) — org=${org ? "found" : "none"}, no decision-maker`);
    return;
  }

  // 3. people/match to reveal email (1 credit)
  const matchRes = await apollo("POST", "/people/match", {
    id: person.id,
    reveal_personal_emails: false,
  });
  await sleep(CALL_GAP_MS);
  const matched = matchRes?.person;
  const email = matched?.email;
  const ownerName = matched?.name || person.name || null;

  if (email && !email.startsWith("email_not_unlocked")) {
    stats[cohort].hits++;
    await prisma.growthLead.update({
      where: { id: lead.id },
      data: { ownerName, email, emailSource: "apollo", stage: "enriched" },
    });
    const masked = email[0] + "***@" + email.split("@")[1];
    samples.push({ cohort, name: lead.name, owner: ownerName, email: masked });
    log(`HIT  [${cohort}] ${lead.name} (${domain}) → ${ownerName} <${masked}>`);
  } else {
    stats[cohort].misses++;
    const note = `apollo: no match ${DATE}`;
    await prisma.growthLead.update({
      where: { id: lead.id },
      data: { notes: lead.notes ? `${lead.notes}\n${note}` : note },
    });
    log(`MISS [${cohort}] ${lead.name} (${domain}) — person ${ownerName ?? "?"} found but no email revealed`);
  }
}

async function main() {
  log(`START apollo-enrich — max ${MAX_PER_COHORT}/cohort, gap ${CALL_GAP_MS}ms`);

  const delivery = await prisma.growthLead.findMany({
    where: { stage: "scraped", offer: "delivery" },
    orderBy: { score: "desc" },
  });
  const site = await prisma.growthLead.findMany({
    where: { stage: "scraped", offer: "site", website: { not: null } },
    orderBy: { score: "desc" },
  });

  try {
    for (const [cohort, leads] of [["delivery", delivery], ["site", site]]) {
      for (const lead of leads) {
        if (stats[cohort].processed >= MAX_PER_COHORT) break;
        await enrichLead(lead, cohort);
      }
    }
  } catch (e) {
    if (e instanceof HardStop) {
      log(`HARD-STOP: ${e.message}`);
    } else {
      log(`ERROR: ${e.message}`);
      throw e;
    }
  } finally {
    const d = stats.delivery, s = stats.site;
    log(`DONE api_calls=${apiCalls} credits_hint=${creditsUsedHint ?? "n/a"}`);
    log(`delivery: processed=${d.processed} hits=${d.hits} misses=${d.misses} skipped=${d.skippedDomain}`);
    log(`site:     processed=${s.processed} hits=${s.hits} misses=${s.misses} skipped=${s.skippedDomain}`);
    for (const x of samples.slice(0, 5)) log(`SAMPLE [${x.cohort}] ${x.name} → ${x.owner} <${x.email}>`);
    await prisma.$disconnect();
  }
}

main();
