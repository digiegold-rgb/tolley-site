/**
 * Jelly Studio — Competitor Gaps brief.
 *
 * Reads the 7-competitor deep-dive JSON, emits a US-Letter, Jelly-1C-branded
 * HTML brief, then renders it to PDF with Playwright.
 *
 *   node scripts/briefs/build-competitor-gaps-brief.mjs
 *
 * Layout is measured, not guessed:
 *   pass 1  renders every gap-matrix row in one open-ended flow and reads back
 *           real row heights, then packs them into pages that actually fit;
 *   pass 2+ re-measures each finished page and zoom-fits any that still run
 *           long, so nothing is ever clipped.
 *
 * Brand tokens mirror scripts/briefs/brand/_base.css (concept 1C).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const SRC_JSON = '/home/jelly/tolley-site/scripts/briefs/data/competitor-deep-dive-2026-08.json';
const OUT_HTML = '/home/jelly/tolley-site/scripts/briefs/jelly-competitor-gaps-2026-08.html';
const OUT_PDF = '/home/jelly/tolley-site/public/research/jelly-competitor-gaps-2026-08.pdf';

const data = JSON.parse(readFileSync(SRC_JSON, 'utf8'));
const { teardowns, synthesis } = data;

/* ------------------------------------------------------------------ utils */
const e = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** "TubeGen AI (tubegen.ai) — Eddie ..." -> { name, note } */
function splitName(full) {
  const m = String(full).match(/^([^(—]+)(?:\((.*?)\))?\s*(?:—\s*(.*))?$/s);
  const name = (m?.[1] || full).trim();
  const bits = [m?.[2], m?.[3]].filter(Boolean).join(' — ');
  return { name, note: bits.replace(/\s+/g, ' ').trim() };
}

/** Trim a URL for display without losing which page it is. */
function shortUrl(u, max = 58) {
  const s = String(u).replace(/^https?:\/\//, '').replace(/\/$/, '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

const MARK = {
  yes: { g: '✓', cls: 'ok' },
  partial: { g: '◐', cls: 'part' },
  no: { g: '✗', cls: 'miss' },
};
const mark = (v) => MARK[String(v).toLowerCase()] || MARK.no;

/** Escape, then offer a break opportunity after each slash so long
 *  slash-joined names ("Pexels/Pixabay/Storyblocks") break where a reader
 *  expects them to instead of mid-word. */
const eBreak = (s) => e(s).replace(/\//g, '/<wbr>');

/* ------------------------------------------- hand-curated snapshot table */
/* Derived from each teardown's pricing_summary + weaknesses. Kept short here;
   the full versions live on the per-competitor pages. */
const SNAPSHOT = [
  {
    who: 'TubeGen AI',
    dom: 'tubegen.ai',
    price:
      'Subscription + credits. Starter <b>$149</b> / Pro $297 / Premium $849 per mo. À-la-carte "Build Your Own Plan" suites from $27/mo. No refunds.',
    perMin: '<b>$1.94–2.47</b>/min<span class="qs">their own "typical" figure</span>',
    len: '30 min export cap',
    free: '<b>None.</b> No free trial at all — you buy blind at $149.',
    gripe:
      'Trustpilot <b>4.1/5 from just 18 reviews</b> — 12 posted on one day (23 Apr 2026). "Best" images burn 90 cr even when the batch comes out wrong; refunds are manual credits via Discord.',
  },
  {
    who: 'Vidnoz AI',
    dom: 'vidnoz.com',
    price:
      'Freemium + subscription + add-ons, credit-metered. Starter <b>$26.99</b>/mo (15 min/mo), Business $74.99/mo (30 min/mo). Voice Clone +$9.99/mo, Avatar Pro +$299/yr.',
    perMin: '<b>~$1.80–2.50</b>/min<span class="qs">of plan minutes, add-ons on top</span>',
    len: '3 min free · 60 min paid',
    free:
      'Real: <b>60 credits/day, no card</b> — but 720p, watermarked, translator capped at 60–90 s.',
    gripe:
      'Trustpilot <b>~2.3/5, ~42% one-star</b> — almost entirely billing: "billed yearly" fine print, surprise renewals, <b>$220 charged when expecting $19.99</b>, no refunds on monthly.',
  },
  {
    who: 'Argil',
    dom: 'argil.ai',
    price:
      'Subscription + credits, no pure pay-per-render. Classic <b>$39</b> / Pro $149 / Scale $499 per mo. PAYG top-ups never expire; Auto Top-Up has a spend cap.',
    perMin: '<b>~$1.50–5.00</b>/min<span class="qs">Atom 160 cr/min ≈ $4.20–4.70</span>',
    len: 'Short-form; not viable past ~10 min',
    free: '3 trial generations, watermarked. 5-day trial that reviewers say paywalls at signup.',
    gripe:
      'Trustpilot <b>2.8/5 (3 reviews)</b> — trial paywalled immediately, no pro-rata refund on annual. Uncanny lip-sync; billing geo-locked ("not available in your region").',
  },
  {
    who: 'StoryShort AI',
    dom: 'storyshort.ai',
    price:
      'Subscription only, credit-metered. Starter <b>$39</b> / Growth $69 / Influencer $129 / Ultra $199 per mo. <b>"All sales are final."</b>',
    perMin: '<b>~$2–5+</b>/video<span class="qs">long-form 85–150 cr, gated to $129+/mo</span>',
    len: 'Up to 10 min (marketing claims 30)',
    free:
      '~10 credits, <b>preview only</b> — export is watermarked/locked. FAQ claims "no watermark"; the app disagrees.',
    gripe:
      'Trustpilot <b>2.5/5</b> — emails unanswered, no complaint path, no refunds. An affiliate says <b>&gt;$1,000 of commissions were marked paid then reversed</b>.',
  },
  {
    who: 'NoLang',
    dom: 'no-lang.com',
    price:
      'Subscription + credits, <b>JPY only</b>. Standard ¥2,980 (~$20) / Premium ¥7,980 (~$53) / Business ¥100k+. API is a separate prepaid wallet.',
    perMin: '<b>~$0.70–2.30</b>/min<span class="qs">≈¥150/min on Standard</span>',
    len: '3 min on Standard; longer = Premium',
    free: 'Real but thin: 3 generations/mo, watermark, <b>videos deleted after 2 weeks</b>.',
    gripe:
      '<b>No Trustpilot / G2 / Product Hunt footprint</b> — zero English reviews. Generic AI-picked stock visuals, TTS mispronunciation, PC-only, BGM triggers YouTube claims.',
  },
  {
    who: 'Zebracat',
    dom: 'zebracat.ai',
    price:
      'Subscription + <b>dual</b> meter (video count AND AI credits). Cat <b>$39</b> / Super Cat $98 / Unlimited $198 per mo; Enterprise $398–599+.',
    perMin:
      'Per-component credits<span class="qs">AI visuals 5/min, cloned voice 4/min, zoom 8/min</span>',
    len: '<b>Hard 5 min</b> on every tier · 1080p cap',
    free: '5 total videos, 30 s, 720p, watermarked, standard voices — no card.',
    gripe:
      'AppSumo <b>3.9/5 with 18 one-taco reviews</b> — lifetime credits swapped for a 30-video/mo cap. Credits expire monthly, no rollover, refunds "a nightmare"; "could not export 50% of the videos."',
  },
  {
    who: 'Faceless.so',
    dom: 'faceless.so',
    price:
      'Subscription + credits. Starter <b>$24</b>/mo (500 cr ≈ 25 videos) → Ultra $166/mo. Top-ups $10 per 100 cr. No refunds once one credit is used.',
    perMin: '<b>~$0.96–$10</b>/video<span class="qs">storyboard 20 cr / lite 50 / pro 100</span>',
    len: '<b>Short-form only</b> — 30/60/90 s, 9:16',
    free:
      '"Sign up free", but <b>their own compare pages say "No free tier"</b> and the demo disables render + upload.',
    gripe:
      'Almost no independent reviews (Groupify 4.75/5 from <b>4</b>). Sibling brands sit at 1.8–3.9 TrustScore over refunds. ToS bans automated access while selling an API; crypto token, spin-and-win and $349/mo "warmed accounts" read gray-hat.',
  },
];

const JELLY_ROW = {
  who: 'Jelly Studio',
  dom: 'tolley.io/<wbr>animate',
  price:
    '<b>Pay-per-render. No subscription, no credits that expire.</b> Compute at cost + $0.35 per finished minute, itemized on the receipt.',
  perMin: '<b>~$1–7</b> per long-form video<span class="qs">2–4.5× under TubeGen</span>',
  len: '9:00 beta cap (raiseable for paid accounts)',
  free: 'Invite-only beta — no public free tier yet. A no-signup demo is a NEXT-priority gap.',
  gripe:
    'No review footprint yet. The counter-positioning is exactly what every row above is getting flamed for: <b>billing</b>.',
};

/* ------------------------------------------------------- gap matrix groups */
const GROUPS = [
  {
    key: 'now',
    title: 'NOW',
    blurb:
      'Ship this month. Cheap UI over engines Jelly already runs — every one closes a complaint a rival is actively getting.',
  },
  {
    key: 'next',
    title: 'NEXT',
    blurb:
      'After the first five payers prove the core loop. Real gaps, but none of them block a first paid render.',
  },
  {
    key: 'later',
    title: 'LATER',
    blurb:
      'Only matters at scale — agencies, teams, growth loops. Building these before revenue is building the wrong company.',
  },
  {
    key: 'skip',
    title: 'SKIP — ON PURPOSE',
    blurb:
      'Listed so nobody re-opens the argument. These are the sources of every competitor’s 2-star reviews. Say "no" on the landing page.',
  },
];

const byPriority = (k) =>
  synthesis.gap_matrix.filter((r) => String(r.priority).toLowerCase() === k);

/* Effort for each top-10 item: match its text back to a gap-matrix row. */
const KEYMAP = [
  'Pre-render cost estimate',
  'Free animatic preview',
  'Failed-render auto-refund',
  'Chapter timestamps',
  'Camera motion and transition controls',
  'Auto overlays',
  'Remix /',
  'Interactive pricing calculator',
  'Bring-your-own voiceover',
  'Scheduling / calendar',
];
function effortFor(i) {
  const needle = KEYMAP[i];
  const row = needle && synthesis.gap_matrix.find((r) => r.feature.includes(needle));
  return row ? { effort: row.effort, cost: row.cost } : { effort: '—', cost: '' };
}

/* -------------------------------------------------------------- fragments */
const footer = (label) =>
  `<div class="ftr"><span>Jelly Studio · Competitor gaps &amp; build plan</span><span>${e(
    label
  )}</span></div>`;

const gapRow = (r, cls, idx) => `
  <tr class="${cls}" data-row="${idx}">
    <td class="g-feat">
      <b>${eBreak(r.feature)}</b>
      <span class="who">${(r.who_has_it || [])
        .map((w) => `<span class="wtag">${e(w)}</span>`)
        .join('')}</span>
    </td>
    <td class="g-why">
      ${e(r.why_it_matters)}
      <div class="today"><span class="tl">Jelly today</span>${e(r.jelly_status)}</div>
    </td>
    <td class="g-how">
      ${e(r.how_we_add_it)}
      <div class="files">${e(r.files_or_services)}</div>
    </td>
    <td class="g-eff">
      <span class="eff eff-${e(String(r.effort).toLowerCase())}">${e(r.effort)}</span>
      <span class="cost">${e(r.cost)}</span>
    </td>
  </tr>`;

const GAP_HEAD = `<thead><tr>
    <th style="width:20%">Feature · who has it</th>
    <th style="width:23%">Why it matters · where Jelly is</th>
    <th style="width:45%">How we add it</th>
    <th style="width:12%">Effort · cost</th>
  </tr></thead>`;

const gHead = (g, cont) => `
  <div class="ghead" data-ghead="${g.key}${cont ? '-cont' : ''}">
    <span class="gpill gp-${g.key}">${e(g.title)}${cont ? ' <i>(cont.)</i>' : ''}</span>
    <span class="gblurb">${e(g.blurb)}</span>
    <span class="gcount">${byPriority(g.key).length} gaps</span>
  </div>`;

const GAP_INTRO = `<h2>The gap matrix</h2>
  <p class="dek">All 31 gaps, grouped by when to build them. <b>NOW rows are in pink.</b>
  "Jelly today" is what actually exists in the codebase — most NOW items mean surfacing an
  engine that already runs, not writing one. Effort is <b>S</b>/<b>M</b>/<b>L</b>; cost is
  new recurring spend.</p>`;

/* ------------------------------------------------------------ page bodies */
function coverPage() {
  const n = GROUPS.map((g) => byPriority(g.key).length);
  return `
  <div class="glow"></div>
  <div class="cov-top">
    <div class="lockup"><span class="jm">J</span><span class="lk">JELLY STUDIO</span></div>
    <div class="stamp">COMPETITIVE TEARDOWN</div>
  </div>

  <div class="cov-mid">
    <div class="kick">Product research · 7 competitors · 31 gaps</div>
    <h1>Jelly Studio<br><span class="vs">vs.</span> the market</h1>
    <div class="sub2">Feature gaps &amp; what to build</div>
    <div class="rule"></div>
    <div class="meta">
      <div><span class="ml">Date</span><span class="mv">August 16, 2026</span></div>
      <div><span class="ml">Prepared for</span><span class="mv">Jared</span></div>
      <div class="wide"><span class="ml">Scope</span><span class="mv">TubeGen · Vidnoz · Argil · StoryShort · NoLang · Zebracat · Faceless.so</span></div>
    </div>
  </div>

  <div class="toc">
    <div class="tochd">What's inside</div>
    <ol>
      <li><span class="tp">02</span>The verdict, Jelly's unique advantages, and the "do not copy" list</li>
      <li><span class="tp">03</span>The market on one page — pricing, real cost per minute, free-tier truth, trust signals</li>
      <li><span class="tp">04</span>The gap matrix — all 31 gaps, grouped NOW / NEXT / LATER / SKIP, with how we add each one</li>
      <li><span class="tp">10</span>Build order for this month — the ten-item checklist</li>
      <li><span class="tp">11</span>Seven competitor teardowns — one page each</li>
    </ol>
  </div>

  <div class="tiles">
    <div class="tile pinkt"><div class="num">${n[0]}</div><div class="lbl">gaps tagged <b>NOW</b> — UI over engines that already run, $0 new spend</div></div>
    <div class="tile"><div class="num">${n[1]}</div><div class="lbl">NEXT, once the first five payers prove the loop</div></div>
    <div class="tile"><div class="num">${n[2]}</div><div class="lbl">LATER — teams, API, analytics, growth loops</div></div>
    <div class="tile violt"><div class="num">${n[3]}</div><div class="lbl">deliberate <b>SKIPS</b> — avatars, stock, autopilot, model menus, subscriptions</div></div>
  </div>

  <div class="cov-note">
    <b>The short version.</b> Nobody out there beats Jelly on capability — they beat it on
    <i>legibility</i>. Every rival shows the price before the click, drafts cheap before it charges,
    and refunds a failed render automatically. Jelly does the hard part already, then surprises the
    user with the bill. This month is cheap UI over engines that are <b>already running</b>, not new engines.
  </div>

  <div class="cov-foot">
    <span>${teardowns.reduce((a, t) => a + t.sources.length, 0)} vendor pages, help centres, pricing bundles &amp; review sites · gathered Aug 15–16, 2026</span>
    <span>tolley.io/animate</span>
  </div>`;
}

function verdictPage() {
  return `
  <h2>The verdict</h2>
  <p class="lead">${e(synthesis.one_paragraph_verdict)}</p>
  <div class="split">
    <div>
      <h3 class="pink">What Jelly has that none of them do</h3>
      <ul class="adv">${synthesis.jelly_unique_advantages.map((x) => `<li>${e(x)}</li>`).join('')}</ul>
    </div>
    <div>
      <h3 class="viol">Do <span class="nope">NOT</span> copy this</h3>
      <ul class="dont">${synthesis.things_to_NOT_copy.map((x) => `<li>${e(x)}</li>`).join('')}</ul>
    </div>
  </div>

  <div class="pitch">
    <div class="ph">The three lines that belong on the landing page</div>
    <div class="pgrid">
      <div class="pc"><span class="pn">01</span><b>No subscription.</b> You pay per render —
        about <b>$1–7</b> for a finished long-form video, itemized on a receipt. Nothing expires.</div>
      <div class="pc"><span class="pn">02</span><b>No stock footage. No avatars.</b> Every frame is
        generated in your locked art style, with the same characters across the whole channel.</div>
      <div class="pc"><span class="pn">03</span><b>See the price before you click Generate</b> —
        and a render that fails refunds itself, with the reason on the receipt.</div>
    </div>
    <div class="pfoot">Lines 1 and 2 are true today. <b>Line 3 is not yet</b> — it is items
      <b>1</b> and <b>3</b> of the build order on page 10. Close those two and the landing page can
      make all three claims without an asterisk.</div>
  </div>
  ${footer('The verdict')}`;
}

function snapshotPage() {
  const row = (r, isJelly) => `
    <tr class="${isJelly ? 'jelly' : ''}">
      <td class="c-who"><b>${r.who}</b><span class="dom">${r.dom}</span></td>
      <td>${r.price}</td>
      <td class="c-min">${r.perMin}</td>
      <td class="c-len">${r.len}</td>
      <td>${r.free}</td>
      <td class="c-gripe">${r.gripe}</td>
    </tr>`;
  return `
  <h2>The market, on one page</h2>
  <p class="dek">Every competitor charges a subscription and meters credits that expire. Six of the
  seven have a public trust problem, and in five of those the complaints are about <b>billing</b>,
  not output quality. That is the hole Jelly is already standing in.</p>

  <table class="snap">
    <thead><tr>
      <th style="width:12.5%">Competitor</th>
      <th style="width:24%">Pricing model</th>
      <th style="width:13%">Effective cost</th>
      <th style="width:11%">Max length</th>
      <th style="width:17%">Free tier — the truth</th>
      <th style="width:22.5%">Trust signal &amp; headline complaint</th>
    </tr></thead>
    <tbody>
      ${SNAPSHOT.map((r) => row(r, false)).join('')}
      ${row(JELLY_ROW, true)}
    </tbody>
  </table>

  <div class="callout">
    <b>Read the last column, not the first.</b> Vidnoz sits at 2.3/5 and StoryShort at 2.5/5 with
    <i>working products</i>. The anger is auto-renewals, expiring credits and "all sales are final."
    Jelly's pay-per-render receipt is not a pricing detail — it is the entire wedge, and the landing
    page should say so in the first screen.
  </div>
  ${footer('Market snapshot')}`;
}

function buildOrderPage() {
  return `
  <h2>Build order for this month</h2>
  <p class="dek">The ten items in the order they should ship. Nine of ten are <b>S-effort</b> and add
  <b>$0</b> of recurring cost — they surface cost math, engines and routes that already exist.
  Items 1–3 are the trust triad: show the price, draft cheap, refund failures. Ship those before the
  first invite goes out. <span class="fyi">Note: nine of these are NOW rows in the matrix; item 10
  (scheduled publish) is tagged NEXT there but rides along because it is a single field on the
  OAuth path Jelly already uses.</span></p>

  <ol class="build">
    ${synthesis.top10_now
      .map((x, i) => {
        const { effort, cost } = effortFor(i);
        return `<li class="${i < 3 ? 'triad' : ''}">
          <span class="bn">${i + 1}</span>
          <span class="bx"></span>
          <span class="bt">${e(x)}</span>
          <span class="be"><span class="eff eff-${e(
            String(effort).toLowerCase()
          )}">${e(effort)}</span><span class="cost">${e(cost)}</span></span>
        </li>`;
      })
      .join('')}
  </ol>

  <div class="split2">
    <div class="box pinkbox">
      <div class="bh">Ship 1–3 before any invite goes out</div>
      <p>Show the estimate, make stills-draft the default, auto-refund failures. Those three turn the
      receipt from a surprise into a promise — and they are the exact three things Vidnoz (2.3/5),
      StoryShort (2.5/5) and Zebracat get flamed for missing.</p>
    </div>
    <div class="box">
      <div class="bh">Then 4–10, in any order</div>
      <p>Chapters, per-scene motion, overlay toggles, Remix, the pricing calculator, BYO narration and
      scheduled publish. Each is a single screen. Only BYO narration is M-effort; the rest are an
      afternoon each over code that already ships.</p>
    </div>
  </div>
  ${footer('Build order')}`;
}

/** Descriptors run to 180+ chars on some rows; keep the page from buckling. */
function clip(s, max) {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(' ')) + '…';
}

function competitorPage(t) {
  const { name, note: rawNote } = splitName(t.competitor);
  const note = clip(rawNote, 150);
  const c = { yes: 0, partial: 0, no: 0 };
  for (const f of t.features) c[String(f.jelly_has).toLowerCase()]++;
  return `
  <div class="chead">
    <div>
      <div class="kick">Competitor teardown</div>
      <h2 class="cname">${e(name)}</h2>
      ${note ? `<div class="cnote">${e(note)}</div>` : ''}
    </div>
    <div class="cscore">
      <span class="sc ok"><b>${c.yes}</b> ✓ Jelly has</span>
      <span class="sc part"><b>${c.partial}</b> ◐ partial</span>
      <span class="sc miss"><b>${c.no}</b> ✗ missing</span>
    </div>
  </div>

  <div class="cgrid">
    <div class="cleft">
      <h4>What they do well</h4>
      <ul class="ux">${t.standout_ux.map((x) => `<li>${e(x)}</li>`).join('')}</ul>
      <h4 class="warn">What users complain about</h4>
      <ul class="wk">${t.weaknesses_users_complain_about
        .map((x) => `<li>${e(x)}</li>`)
        .join('')}</ul>
    </div>
    <div class="cright">
      <h4>Feature list vs. Jelly</h4>
      <div class="fkey"><span class="ok">✓</span> Jelly has it &nbsp;·&nbsp;
        <span class="part">◐</span> partial &nbsp;·&nbsp;
        <span class="miss">✗</span> missing</div>
      <ul class="feat">
        ${t.features
          .map((f) => {
            const m = mark(f.jelly_has);
            return `<li><span class="m ${m.cls}">${m.g}</span>${e(f.feature)}</li>`;
          })
          .join('')}
      </ul>
    </div>
  </div>

  <div class="csrc">
    <span class="sl">Sources (${t.sources.length})</span>
    ${t.sources.slice(0, 14).map((u) => `<span class="u">${e(shortUrl(u))}</span>`).join('')}
    ${t.sources.length > 14 ? `<span class="u more">+${t.sources.length - 14} more</span>` : ''}
  </div>
  ${footer(name)}`;
}

/* --------------------------------------------------------- document build */
const here = (f) => new URL(f, import.meta.url).pathname;
/* Fonts are inlined as base64 woff2 (latin + latin-ext) so the PDF renders
   identically with no network and no locally-installed fonts. */
const FONT_CSS = readFileSync(here('./competitor-gaps-fonts.css'), 'utf8');
const CSS = readFileSync(here('./competitor-gaps.css'), 'utf8');

function doc(bodyPages, { measure = false } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Jelly Studio vs. the market — feature gaps &amp; what to build</title>
<style>
${FONT_CSS}
${CSS}
${measure ? '.page.mez{min-height:0;height:auto;page-break-after:auto}' : ''}
</style>
</head>
<body${measure ? ' class="measuring"' : ''}>
${bodyPages.join('\n')}
</body>
</html>
`;
}

const pageHtml = (cls, inner, zoom) =>
  `<div class="page ${cls}"><div class="pw"${
    zoom && zoom < 1 ? ` style="zoom:${zoom.toFixed(4)}"` : ''
  }>${inner}</div></div>`;

/* Pass-1 document: one open-ended page holding every gap chrome element so we
   can read back its true rendered height at the final column widths. */
function measureDoc() {
  const rows = [];
  let i = 0;
  for (const g of GROUPS) {
    rows.push(gHead(g, false), gHead(g, true));
    rows.push(
      `<table class="gap">${GAP_HEAD}<tbody>${byPriority(g.key)
        .map((r) => gapRow(r, `p-${g.key}`, i++))
        .join('')}</tbody></table>`
    );
  }
  return doc([
    pageHtml('mez', `<div id="mez-intro">${GAP_INTRO}</div>${rows.join('')}`, 1),
  ]);
}

/* ------------------------------------------------------------------ render */
const browser = await chromium.launch({
  args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
const TMP = '/tmp/jelly-competitor-gaps-measure.html';

async function load(html, file) {
  writeFileSync(file, html);
  await page.goto('file://' + file, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(180);
}

/* ---- pass 1: measure real heights of every gap-matrix piece -------------- */
await load(measureDoc(), TMP);
/* The faces are unicode-range'd data URIs, so they only load on demand — ask for
   each weight explicitly, then report what actually resolved. */
const fonts = await page.evaluate(async () => {
  const want = [
    ['Space Grotesk', 400],
    ['Space Grotesk', 600],
    ['Space Grotesk', 700],
    ['IBM Plex Mono', 400],
    ['IBM Plex Mono', 500],
    ['IBM Plex Mono', 600],
  ];
  const out = [];
  for (const [family, weight] of want) {
    const loaded = await document.fonts.load(`${weight} 12px "${family}"`, 'Handgloves');
    out.push(`${family.split(' ')[0]}@${weight}:${loaded.length ? 'ok' : 'MISSING'}`);
  }
  return out;
});
console.log('fonts:', fonts.join('  '));

const M = await page.evaluate(() => {
  const h = (el) => (el ? Math.ceil(el.getBoundingClientRect().height) : 0);
  const cs = (el, p) => parseFloat(getComputedStyle(el)[p]) || 0;
  const out = { rows: {}, gheads: {}, intro: 0, thead: 0 };
  out.intro = h(document.getElementById('mez-intro'));
  document.querySelectorAll('[data-ghead]').forEach((el) => {
    out.gheads[el.dataset.ghead] = h(el) + cs(el, 'marginTop') + cs(el, 'marginBottom');
  });
  document.querySelectorAll('tr[data-row]').forEach((el) => {
    out.rows[el.dataset.row] = h(el);
  });
  out.thead = h(document.querySelector('table.gap thead tr'));
  return out;
});

/* content box of a real page: 11in − padding-top − padding-bottom − footer */
const AVAIL = Math.floor(11 * 96 - 0.5 * 96 - 0.46 * 96 - 26);

/* ---- pack gap rows into pages using the measured heights ---------------- */
const chunks = [];
{
  let cur = null;
  let used = 0;
  let idx = 0;
  let firstPageOfDoc = true;
  for (const g of GROUPS) {
    const rows = byPriority(g.key);
    let firstOfGroup = true;
    for (const r of rows) {
      const rh = M.rows[idx] ?? 60;
      const hh = (M.gheads[g.key + (firstOfGroup ? '' : '-cont')] ?? 34) + M.thead;
      const introH = firstPageOfDoc ? M.intro : 0;
      const needNew =
        !cur ||
        used +
          rh +
          (cur.blocks[cur.blocks.length - 1]?.group === g.key ? 0 : hh) +
          introH >
          AVAIL;
      if (needNew) {
        cur = { blocks: [], intro: chunks.length === 0 };
        chunks.push(cur);
        used = chunks.length === 1 ? M.intro : 0;
      }
      firstPageOfDoc = false;
      let blk = cur.blocks[cur.blocks.length - 1];
      if (!blk || blk.group !== g.key) {
        blk = { group: g.key, cont: !firstOfGroup, rows: [] };
        cur.blocks.push(blk);
        used += (M.gheads[g.key + (blk.cont ? '-cont' : '')] ?? 34) + M.thead;
      }
      blk.rows.push({ r, idx });
      used += rh;
      idx++;
      firstOfGroup = false;
    }
  }
}

function gapPages(chunkList) {
  return chunkList.map((ch, i) => {
    const inner = ch.blocks
      .map((blk) => {
        const g = GROUPS.find((x) => x.key === blk.group);
        return `${gHead(g, blk.cont)}<table class="gap">${GAP_HEAD}<tbody>${blk.rows
          .map(({ r, idx }) => gapRow(r, `p-${g.key}`, idx))
          .join('')}</tbody></table>`;
      })
      .join('');
    const head = ch.intro
      ? GAP_INTRO
      : `<h2 class="cont">The gap matrix <span class="cnum">${i + 1} of ${
          chunkList.length
        }</span></h2>`;
    return { cls: '', inner: `${head}${inner}${footer('Gap matrix')}` };
  });
}

/* ------------------------------------------------- assemble the full deck */
function assemble(zooms) {
  const list = [
    { cls: 'cover', inner: coverPage() },
    { cls: '', inner: verdictPage() },
    { cls: '', inner: snapshotPage() },
    ...gapPages(chunks),
    { cls: '', inner: buildOrderPage() },
    ...teardowns.map((t) => ({ cls: 'comp', inner: competitorPage(t) })),
  ];
  return { list, html: doc(list.map((p, i) => pageHtml(p.cls, p.inner, zooms[i] ?? 1))) };
}

/* ---- pass 2+: converge each page on the largest zoom (≤1) that fits -----
   Measures the real rendered height of the content wrapper, so a page that
   overshot on the previous pass is allowed to grow back rather than staying
   needlessly small. */
/* Monotone descent: every page starts at 1.0 and only ever steps down, so the
   result is deterministic. Chasing an exact ratio oscillates instead, because
   zoom reflows column balancing and content height moves in jumps. */
const ZOOM_FLOOR = 0.86;
const ZOOM_STEP = 0.97;
let zooms = new Array(100).fill(1);
let fit = [];
for (let attempt = 0; attempt < 14; attempt++) {
  const { html } = assemble(zooms);
  await load(html, OUT_HTML);
  fit = await page.evaluate(() => {
    const LIMIT = 11 * 96;
    return [...document.querySelectorAll('.page')].map((el, i) => {
      const pw = el.querySelector('.pw');
      return {
        page: i + 1,
        label:
          el.querySelector('h1,h2')?.textContent.trim().replace(/\s+/g, ' ').slice(0, 30) ||
          '(cover)',
        h: Math.round(el.getBoundingClientRect().height),
        over: Math.round(el.getBoundingClientRect().height - LIMIT),
        contentH: Math.ceil(pw.getBoundingClientRect().height),
        zoom: +(parseFloat(getComputedStyle(pw).zoom) || 1).toFixed(4),
        clipped: el.scrollHeight > el.clientHeight + 1,
      };
    });
  });

  const over = fit.filter((f) => f.over > 0 || f.clipped);
  if (!over.length) break;
  for (const f of over) {
    // Cover uses a flex min-height to push its tiles down; never rescale it.
    if (f.page === 1) continue;
    zooms[f.page - 1] = Math.max(ZOOM_FLOOR, +(zooms[f.page - 1] * ZOOM_STEP).toFixed(4));
  }
  console.log(
    `pass ${attempt + 1}: shrinking ${over.length} page(s) → ` +
      over.map((f) => `p${f.page} +${f.over}px → zoom ${zooms[f.page - 1]}`).join(' · ')
  );
}

console.table(fit);
const bad = fit.filter((f) => f.over > 0 || f.clipped);
console.log(bad.length ? 'OVERFLOW: ' + JSON.stringify(bad) : `ALL ${fit.length} PAGES FIT`);

await page.pdf({
  path: OUT_PDF,
  format: 'Letter',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();
console.log(`HTML  → ${OUT_HTML}`);
console.log(`PDF   → ${OUT_PDF}  (${fit.length} pages)`);
