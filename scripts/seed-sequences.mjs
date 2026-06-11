// Seed cold-email sequences as GrowthTouch DRAFTS (approve-send in /hq).
// Usage (from tolley-site/): node --env-file=.env.local scripts/seed-sequences.mjs [--site N] [--delivery N] [--video N]
// Idempotent: skips a lead that already has a seeded draft (meta.seq set).
// HARD RULE: never seed stage=client (Buckeye, Wayne) — cold copy only for fresh prospects.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? parseInt(process.argv[i + 1], 10) : d; };
const SITE_N = arg("--site", 20);
const DELIV_N = arg("--delivery", 30);
const VIDEO_N = arg("--video", 20);

const cap = (s) => (s || "").replace(/\b\w/g, (c) => c.toUpperCase());
const firstName = (l) => "there"; // owner name lands via Apollo enrichment; safe fallback now
const fill = (t, l) => t
  .replaceAll("{{firstName}}", l.ownerName?.split(" ")[0] || firstName(l))
  .replaceAll("{{business}}", cap(l.name))
  .replaceAll("{{city}}", l.city || "your area")
  .replaceAll("{{category}}", (l.category || "your service").toLowerCase())
  .replaceAll("{{reviews}}", l.reviews ?? "")
  .replaceAll("{{rating}}", l.rating ?? "")
  .replaceAll("{{demoUrl}}", l.demoUrl ? `https://tolley.io${l.demoUrl}` : "")
  .replaceAll("{{videoUrl}}", l.videoUrl ? `https://www.tolley.io${l.videoUrl}` : "");

const SITE = [
  { d: 0, subject: "built {{business}} a new website (preview inside)", body: `Hey {{firstName}},\n\nI'm a web developer here in the KC area. I noticed {{business}} has a great reputation — {{rating}}★ across {{reviews}} reviews — but not a website that matches it.\n\nSo I built you one. No catch, here's the preview: {{demoUrl}}\n\nIf you like it, I can have it live this week for $500, then $49/mo for hosting and updates. If not, no worries — keep the preview link.\n\n— Jared, Tolley Digital · Independence, MO` },
  { d: 3, subject: "re: built {{business}} a new website", body: `Hey {{firstName}}, did the preview come through? {{demoUrl}}\n\nQuick reason this matters: when someone searches "{{category}} near me," the shops with a real mobile site and click-to-call show up first and get the call. Yours would too.\n\nWant me to flip it on? Takes me about a day.` },
  { d: 7, subject: "should I take the {{business}} preview down?", body: `{{firstName}} — I'll keep the preview up a few more days before I clear it out.\n\nIf you want it live: $500 setup, $49/mo, done this week, cancel anytime. Just reply "go" and I'll send the link — you can even do it yourself right from the preview page.` },
  { d: 12, subject: "closing this out", body: `No worries {{firstName}} — I'll assume the timing's not right and stop emailing. The preview stays at {{demoUrl}} if you ever want it. Either way, glad {{business}} is doing well in {{city}}.` },
];

const DELIVERY = [
  { d: 0, subject: "weekly delivery routes for {{business}}?", body: `Hi {{firstName}},\n\nI run scheduled last-mile delivery for distributors here in KC — including the local operation of Buckeye International (cleaning/janitorial supply). We handle their weekly routes and the invoicing runs itself.\n\nIf {{business}} ever needs reliable recurring delivery — same driver, fixed weekly schedule, automated billing at $2.80/mi — I'd love to quote a route. Worth a quick look?\n\n— Jared, Your KC Homes / Tolley · Independence, MO` },
  { d: 4, subject: "re: weekly delivery routes for {{business}}?", body: `{{firstName}}, the pitch is simple: you stop chasing one-off couriers and stop hand-writing delivery invoices. We run the route on a set schedule and you get one clean weekly invoice, reconciled automatically.\n\nHappy to do one trial week, no contract, so you can see if it fits.` },
  { d: 9, subject: "last note on delivery", body: `No problem if it's not a fit right now, {{firstName}}. If your delivery needs ever change, we've got capacity for one or two more recurring routes in the {{city}} area. I'll leave it there — thanks for the time.` },
];

const VIDEO = [
  { d: 0, subject: "I made {{business}} a 15-second video", body: `Hey {{firstName}},\n\nI make short promo videos for local businesses here in the KC area, and I made one for {{business}} — built from your real info ({{rating}}★ on Google, your actual {{category}} work, {{city}}).\n\nNo catch, here it is: {{videoUrl}}\n\nIf you like it, it's yours to run on Facebook, Instagram, your Google profile — anywhere. $250 one-time, or $99/mo and I keep fresh videos coming.\n\n— Jared, Tolley Digital · Independence, MO` },
  { d: 3, subject: "re: I made {{business}} a 15-second video", body: `Hey {{firstName}}, did you get a chance to watch? {{videoUrl}}\n\nIt's 15 seconds — shorter than this email. Businesses posting short video get seen way more than ones posting nothing, and most {{category}} shops in {{city}} are posting nothing.\n\nWant it? Reply "yes" and it's yours this week.` },
  { d: 8, subject: "planning to take the {{business}} video down", body: `{{firstName}} — I'll keep your video up a few more days before I clear it out.\n\nIf you want it: $250 one-time and it's yours forever, or $99/mo and I keep two fresh ones coming every month. You can grab it right from the page: {{videoUrl}}` },
  { d: 13, subject: "closing this out", body: `No worries {{firstName}} — I'll assume the timing's not right and stop emailing. The video stays at {{videoUrl}} a little while longer if you ever want it. Either way, glad {{business}} is doing well in {{city}}.` },
];

async function seed(leads, steps, seqName) {
  let made = 0, skipped = 0;
  for (const l of leads) {
    const exists = await prisma.growthTouch.findFirst({ where: { leadId: l.id, channel: "email", meta: { path: ["seq"], equals: seqName } } });
    if (exists) { skipped++; continue; }
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      await prisma.growthTouch.create({ data: {
        leadId: l.id, channel: "email", direction: "out", status: "draft",
        subject: fill(s.subject, l), body: fill(s.body, l),
        meta: { seq: seqName, step: i + 1, sendOffsetDays: s.d },
      }});
    }
    made++;
  }
  return { made, skipped };
}

const siteLeads = await prisma.growthLead.findMany({ where: { offer: "site", stage: "demo_built" }, orderBy: { score: "desc" }, take: SITE_N });
const delivLeads = await prisma.growthLead.findMany({ where: { offer: "delivery", stage: { notIn: ["client", "dead"] } }, orderBy: { score: "desc" }, take: DELIV_N });
const videoLeads = await prisma.growthLead.findMany({ where: { offer: "video", stage: "demo_built", email: { not: null } }, orderBy: { score: "desc" }, take: VIDEO_N });

const r1 = await seed(siteLeads, SITE, "site-v1");
const r2 = await seed(delivLeads, DELIVERY, "delivery-v1");
const r3 = await seed(videoLeads, VIDEO, "video-v1");
console.log(`site-v1: ${r1.made} leads seeded (${r1.skipped} skipped) → ${r1.made * SITE.length} drafts`);
console.log(`delivery-v1: ${r2.made} leads seeded (${r2.skipped} skipped) → ${r2.made * DELIVERY.length} drafts`);
console.log(`video-v1: ${r3.made} leads seeded (${r3.skipped} skipped) → ${r3.made * VIDEO.length} drafts`);
console.log(`All drafts are status="draft" — approve in tolley.io/hq before any send.`);
await prisma.$disconnect();
