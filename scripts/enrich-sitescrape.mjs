// Engine 1 step 2b — FREE website-scrape enrichment (Apollo workaround).
// Mines each scraped lead's own website for a published contact email.
// Usage (from tolley-site/): node --env-file=.env.local scripts/enrich-sitescrape.mjs [--limit N] [--offer site|delivery]
//
// Hit  -> email, emailSource="site-scrape", stage="enriched"  (mirrors enrich-prospects.mjs)
// Miss -> notes += "sitescrape: no email <date>"
// $0 cost. Polite: 8s timeout, 3 pages/site max, concurrency 8.

import { PrismaClient } from "@prisma/client";
import { mkdirSync, appendFileSync } from "node:fs";

const prisma = new PrismaClient();
const DATE = new Date().toISOString().slice(0, 10);
const LOG_DIR = "/home/jelly/growth-engine/logs";
const LOG_FILE = `${LOG_DIR}/sitescrape-enrich-${DATE}.log`;
mkdirSync(LOG_DIR, { recursive: true });
const log = (m) => { const l = `${new Date().toISOString()} ${m}`; console.log(l); appendFileSync(LOG_FILE, l + "\n"); };

const args = process.argv.slice(2);
const LIMIT = Number((args.find(a => a.startsWith("--limit")) || "").split("=")[1] || args[args.indexOf("--limit") + 1]) || 500;
const OFFER = (args.includes("--offer")) ? args[args.indexOf("--offer") + 1] : null;
const CONCURRENCY = 8;
const PAGE_PATHS = ["", "/contact", "/contact-us", "/about", "/about-us"];
const MAX_PAGES = 3;
const TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (compatible; TolleyBot/1.0; +https://tolley.io)";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BAD_DOMAINS = ["example.com","example.org","xyz.com","domain.com","yourdomain.com","yourcompany.com","company.com","website.com","email.com","sentry.io","sentry-next.wixpress.com","wixpress.com","wix.com","godaddy.com","squarespace.com","schema.org","w3.org","googleapis.com","gstatic.com","cloudflare.com","jquery.com","fontawesome.com","sentry.wixpress.com"];
const BAD_LOCAL = ["your","youremail","email","name","user","example","sample","test","noreply","no-reply","donotreply"];
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|ico|css|js)$/i;
const ROLE_PREFIX = ["info","contact","sales","office","hello","admin","owner","support","service"];

function extractEmails(html, siteHost) {
  const found = new Map(); // email -> score
  if (!html) return found;
  const raw = new Set();
  // mailto: links (highest trust)
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) raw.add(decodeURIComponent(m[1]).toLowerCase());
  // plain-text emails
  for (const m of html.matchAll(EMAIL_RE)) raw.add(m[0].toLowerCase());
  for (let e of raw) {
    e = e.replace(/[.,;:]+$/, "");
    if (IMG_EXT.test(e)) continue;
    const [local, domain] = e.split("@");
    if (!local || !domain) continue;
    if (BAD_DOMAINS.some(b => domain.endsWith(b))) continue;
    if (BAD_LOCAL.includes(local)) continue;
    if (local.length < 2 || domain.length < 4) continue;
    let score = 1;
    const baseHost = (siteHost || "").replace(/^www\./, "");
    if (domain === baseHost || domain.endsWith("." + baseHost)) score += 10; // same-domain = real business mailbox
    if (!ROLE_PREFIX.includes(local)) score += 3; // personal-looking name preferred over generic role
    if (ROLE_PREFIX.includes(local)) score += 1;
    found.set(e, Math.max(found.get(e) || 0, score));
  }
  return found;
}

async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA, "Accept": "text/html" } });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("html") && !ct.includes("text")) return null;
    return (await r.text()).slice(0, 600000);
  } catch { return null; } finally { clearTimeout(t); }
}

async function enrichLead(lead) {
  let base;
  try { base = new URL(lead.website.startsWith("http") ? lead.website : `https://${lead.website}`); }
  catch { return { lead, status: "badurl" }; }
  const host = base.hostname;
  const candidates = new Map();
  let pages = 0;
  for (const path of PAGE_PATHS) {
    if (pages >= MAX_PAGES) break;
    const url = new URL(path, base.origin).toString();
    const html = await fetchPage(url);
    pages++;
    if (!html) continue;
    for (const [e, s] of extractEmails(html, host)) candidates.set(e, Math.max(candidates.get(e) || 0, s));
    // homepage hit with same-domain email is good enough; stop early
    if ([...candidates.values()].some(v => v >= 11)) break;
  }
  if (candidates.size === 0) return { lead, status: "miss" };
  const best = [...candidates.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { lead, status: "hit", email: best, all: [...candidates.keys()] };
}

const mask = (e) => e.replace(/^(.).*(@.*)$/, "$1***$2");

async function run() {
  const where = { stage: "scraped", email: null, website: { not: null } };
  if (OFFER) where.offer = OFFER;
  const leads = await prisma.growthLead.findMany({ where, take: LIMIT });
  log(`START sitescrape-enrich — ${leads.length} leads, concurrency ${CONCURRENCY}, ${MAX_PAGES} pages/site`);
  let hits = 0, miss = 0, bad = 0;
  let i = 0;
  async function worker() {
    while (i < leads.length) {
      const lead = leads[i++];
      let res;
      try { res = await enrichLead(lead); } catch (e) { res = { lead, status: "err", msg: e.message }; }
      if (res.status === "hit") {
        await prisma.growthLead.update({ where: { id: lead.id }, data: { email: res.email, emailSource: "site-scrape", stage: "enriched" } });
        hits++; log(`HIT  [${lead.offer}] ${lead.name} (${new URL(lead.website.startsWith("http")?lead.website:`https://${lead.website}`).hostname}) → ${mask(res.email)}${res.all.length>1?` (+${res.all.length-1})`:""}`);
      } else {
        const note = `sitescrape: no email ${DATE}`;
        await prisma.growthLead.update({ where: { id: lead.id }, data: { notes: lead.notes ? `${lead.notes}\n${note}` : note } });
        if (res.status === "badurl") bad++; else miss++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  log(`DONE hits=${hits} miss=${miss} badurl=${bad} total=${leads.length}`);
  await prisma.$disconnect();
}
run().catch(async (e) => { log(`FATAL ${e.message}`); await prisma.$disconnect(); process.exit(1); });
