/**
 * Jelly Studio — Capability Map. Everything a signed-in user can DO in
 * tolley.io/animate, screen by screen, with the tier that unlocks it.
 *
 *   node scripts/briefs/build-jelly-capabilities-doc.mjs
 *
 * US-Letter navy/gold brief in the house style →
 * public/research/jelly-studio-capabilities-2026-08.pdf
 *
 * Source of truth: scripts/briefs/data/jelly-studio-actions.json, compiled
 * 2026-08-25 by sweeping every screen under components/animate/screens/**,
 * the editor steps, and all ~180 routes under app/api/vater/** + app/api/v1/**.
 * Re-run after adding features; edit the JSON, not this file's prose.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = '/home/jelly/tolley-site/scripts/briefs';
const CSS = readFileSync(`${BASE}/lady-video-system.css`, 'utf8');
const ITEMS = JSON.parse(readFileSync(`${BASE}/data/jelly-studio-actions.json`, 'utf8'));
const OUT_HTML = `${BASE}/jelly-studio-capabilities-2026-08.html`;
const OUT_PDF = '/home/jelly/tolley-site/public/research/jelly-studio-capabilities-2026-08.pdf';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TIERS = { public: 'Everyone', studio: 'Studio', owner: 'Owner', admin: 'Admin', api: 'API key' };

let PAGE = 0;
const page = (body, cls = '') => {
  PAGE++;
  return `<div class="page ${cls}"><div class="pinner">${body}</div>
    <div class="footer"><span>Jelly Studio — what a user can do</span><span>tolley.io/hq · Aug 25, 2026 · p${PAGE}</span></div>
  </div>`;
};

const count = (t) => ITEMS.filter((i) => i.t === t).length;
const screens = [];
for (const it of ITEMS) if (!screens.includes(it.s)) screens.push(it.s);

/* ── doc-specific styles, house palette ───────────────────────────────── */
const EXTRA = `
.legend{display:flex;gap:14pt;flex-wrap:wrap;margin:7pt 0 0;font-size:8.2pt;color:var(--ink2)}
.legend b{color:var(--navy)}
.pill{display:inline-block;font-size:6.6pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  border-radius:99px;padding:1pt 5pt;vertical-align:1.5pt;white-space:nowrap;border:1px solid}
.pill.studio{color:var(--gold-dark);border-color:#d9bd57;background:var(--goldwash)}
.pill.owner{color:#8c2f2f;border-color:#e0a9a9;background:#fdf2f2}
.pill.admin{color:#5b3f96;border-color:#c3b2e6;background:#f6f3fd}
.pill.api{color:#1c5f77;border-color:#a8cfdd;background:#eef7fa}
.inv{column-count:2;column-gap:16pt}
.scr{break-inside:avoid-column;margin:0 0 5pt}
.scr h3{font-size:8.6pt;color:var(--navy);margin:0 0 2.5pt;padding-bottom:1.5pt;border-bottom:1.5px solid var(--gold);
  letter-spacing:.02em;text-transform:uppercase;break-after:avoid}
.scr h3 em{font-style:normal;color:var(--muted);font-weight:600;font-size:7pt;float:right}
.act{margin:0 0 2.6pt;font-size:7.5pt;line-height:1.33;color:var(--ink2);break-inside:avoid}
.act b{color:var(--ink);font-weight:700}
.scr h3 .ct{font-weight:600;color:var(--muted);font-size:6.6pt;text-transform:none;letter-spacing:0}
.gates{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8pt;margin:7pt 0 0}
.gate{border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:5px;padding:7pt 8pt;background:var(--card)}
.gate .t{font-weight:800;color:var(--navy);font-size:9pt;margin-bottom:2pt}
.gate p{margin:0;font-size:7.8pt;color:var(--ink2);line-height:1.35}
table.tiers{width:100%;border-collapse:collapse;font-size:8pt;margin-top:5pt}
table.tiers th{background:var(--wash);color:var(--navy);text-align:left;padding:4pt 6pt;font-size:7.6pt;
  letter-spacing:.05em;text-transform:uppercase;border-bottom:2px solid var(--gold)}
table.tiers td{padding:3.6pt 6pt;border-bottom:1px solid var(--line);vertical-align:top;color:var(--ink2)}
table.tiers td b{color:var(--ink)}
table.tiers td.n{font-weight:800;color:var(--navy);text-align:right;width:34pt}
`;

/* ── p1 cover ─────────────────────────────────────────────────────────── */
const p1 = page(`
  <div class="cover-band">
    <div class="v2tag">CAPABILITY MAP</div>
    <div class="kicker">HQ · Docs · Product reference</div>
    <h1>Jelly Studio &mdash; what a user can do</h1>
    <div class="date">Every action in tolley.io/animate, screen by screen, with the tier that unlocks it &middot; as built, August 25, 2026</div>
  </div>

  <p class="lede">This is the product as it actually ships today &mdash; <b>${ITEMS.length} distinct things</b> a signed-in
  person can do across <b>${screens.length} screens</b>, compiled by reading every screen component and all ~180 API
  routes rather than the roadmap. <b>${count('public')} of them are open to every account</b>; the rest sit behind the
  studio tier, the owner account, an API key, or admin support tooling. Use it to answer &ldquo;can it do X?&rdquo;,
  to write help copy, or to see what a new customer actually gets on day one.</p>

  <div class="tiles five">
    <div class="tile goldtop"><div class="num">${ITEMS.length}</div><div class="lbl">actions documented<br>buttons, toggles, uploads, gates</div></div>
    <div class="tile"><div class="num">${screens.length}</div><div class="lbl">screens &amp; surfaces<br>incl. 7 editor steps</div></div>
    <div class="tile greentop"><div class="num">${count('public')}</div><div class="lbl">open to everyone<br>no tier, no allowlist</div></div>
    <div class="tile purpletop"><div class="num">${count('studio')}</div><div class="lbl">studio tier<br>tuner, review, dictate, course</div></div>
    <div class="tile redtop"><div class="num">${count('owner') + count('admin') + count('api')}</div><div class="lbl">owner / admin / API<br>ops tooling &amp; the customer API</div></div>
  </div>

  <h2><span class="n">01</span>How to read it</h2>
  <p>Each line is one action and one sentence on what it does. A line with no badge is available to
  <b>every signed-in account</b>. Badges mark the gate:</p>
  <div class="legend">
    <span><span class="pill studio">Studio</span> &nbsp;the studio tier &mdash; an email allowlist, today Trey and the team</span>
    <span><span class="pill owner">Owner</span> &nbsp;the owner account &mdash; ops and pipeline tooling</span>
    <span><span class="pill admin">Admin</span> &nbsp;site admins &mdash; support sessions and invites</span>
    <span><span class="pill api">API key</span> &nbsp;machine access via <code>jly_live_</code> keys</span>
  </div>

  <div class="box gold" style="margin-top:8pt">
    <p><b>The one rule that shapes the whole product:</b> nothing spends money without a human click. Every render,
    animation, thumbnail batch and social post sits behind a confirm dialog that shows the estimate first, failed
    renders are never charged, and every finished video gets an itemised receipt. That is why so many of the
    ${ITEMS.length} actions below are gates, previews and estimates rather than fire-and-forget buttons.</p>
  </div>

  <h2><span class="n">02</span>The three money gates</h2>
  <div class="gates">
    <div class="gate"><div class="t">1 &middot; Approve the script</div><p>Nothing renders until a person approves the
    script. Writing, pasting, importing and editing are all free; the Approve &amp; Animate button is the first
    dollar.</p></div>
    <div class="gate"><div class="t">2 &middot; Confirm the render</div><p>A manifest of style, character, voice, art
    style, soundtrack and motion with the estimate. Missing pieces block it with a &ldquo;Fix it&rdquo; jump instead of
    failing mid-render.</p></div>
    <div class="gate"><div class="t">3 &middot; Confirm the post</div><p>Every outbound publish &mdash; YouTube, TikTok,
    Instagram, Facebook, Pinterest, X, LinkedIn &mdash; is an explicit click. Nothing auto-posts on a customer's
    behalf.</p></div>
  </div>
`);

/* ── p2 the golden path ───────────────────────────────────────────────── */
const p2 = page(`
  <h2><span class="n">03</span>The golden path &mdash; idea to published video</h2>
  <p class="sub">Nine steps. A first-time user touches maybe fifteen of the ${ITEMS.length} actions; everything else is
  depth they grow into.</p>
  <div class="flow tight">
    <div class="frow"><div class="fnum">01<small>style</small></div>
      <div class="fbody"><div class="ft">Pick or build a Style</div>
      <div class="fd">A Style is the reusable identity of a channel: art direction, cast, voice, captions, aspect ratio, brand kit. Start from a system preset, clone one, or upload a single selfie and get a matching art style plus a consistent character in about ten seconds.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">02<small>script</small></div>
      <div class="fbody"><div class="ft">Bring a script or have one written</div>
      <div class="fd">Paste your own for free, or generate one from a target word count, a reference URL, an imported article or PDF, live web search, and an optional creator archetype. Every save is a version you can restore.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">03<small>voice</small></div>
      <div class="fbody"><div class="ft">Choose a voice &mdash; or upload your own narration</div>
      <div class="fd">Clone a voice from five seconds of audio, use a shared voice, or connect your own ElevenLabs key so narration bills your plan, not ours. Upload a real recording instead and the captions and scenes align to it. A pronunciation dictionary fixes names, and any single line can be re-voiced on its own.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">04<small>engine</small></div>
      <div class="fbody"><div class="ft">Jelly Auto or Fable&nbsp;5 Concierge</div>
      <div class="fd">Auto runs the pipeline with a live estimate. Fable 5 hands the script to an AI director that plans every scene, renders, audits each frame against the rulebook, repairs what fails and reports back &mdash; with your director notes as staging instructions.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">05<small>visuals</small></div>
      <div class="fbody"><div class="ft">Render the stills draft first</div>
      <div class="fd">The cheap default: every scene as a still with camera motion and no animation spend. Review and re-render individual prompts, then buy motion only where it earns its keep &mdash; per scene, for the long scenes, or all of them.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">06<small>polish</small></div>
      <div class="fbody"><div class="ft">Edit scene by scene</div>
      <div class="fd">In the timeline editor each scene has its own beat text, image prompt, renderer, motion prompt, motion intensity and optional chart / map / header overlay. Drafts are snapshots you can revert to.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">07<small>package</small></div>
      <div class="fbody"><div class="ft">Thumbnail, title, description</div>
      <div class="fd">Generate thumbnail concepts and variants, SEO title and description with tags, and append chapters and hashtags &mdash; all editable before anything leaves the studio.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">08<small>ship</small></div>
      <div class="fbody"><div class="ft">Publish, or take the file</div>
      <div class="fd">Connect your own accounts (billed per connected account, priced before you connect) and post from the Library, or just download the MP4 and use your own scheduler. Cut a 9:16 short or a vertical re-frame from any finished video for free.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">09<small>account</small></div>
      <div class="fbody"><div class="ft">Know what it cost</div>
      <div class="fd">Compute at cost plus $0.35 per finished minute, quoted before and itemised after. A monthly cap, a credit ledger, per-video receipts, a system log you can copy for support, team seats, referral credit and API keys with webhooks.</div></div></div>
  </div>
`);

/* ── inventory pages ──────────────────────────────────────────────────── */
const rowW = (r) => Math.max(1, Math.ceil((r.a.length + r.d.length) / 96));
const mkBlock = (s, rows, cont = false) => ({
  s,
  rows,
  cont,
  weight: 1.9 + rows.reduce((n, r) => n + rowW(r), 0),
});
// One block per screen — but a screen too tall to ever fit beside another is
// pre-split so the packer has finer granularity and no page ends up a sliver.
const MAX_BLOCK = 26;
const blocks = [];
for (const s of screens) {
  const rows = ITEMS.filter((i) => i.s === s);
  const whole = mkBlock(s, rows);
  if (whole.weight <= MAX_BLOCK) {
    blocks.push(whole);
    continue;
  }
  let part = [];
  let pw = 1.9;
  for (const r of rows) {
    if (pw + rowW(r) > MAX_BLOCK && part.length) {
      blocks.push(mkBlock(s, part, blocks.some((b) => b.s === s)));
      part = [];
      pw = 1.9;
    }
    part.push(r);
    pw += rowW(r);
  }
  if (part.length) blocks.push(mkBlock(s, part, blocks.some((b) => b.s === s)));
}

// Pack the screen blocks into pages. First pass with the max a page can hold,
// then re-pack to the average so the last page isn't a sliver (block sizes are
// atomic, so greedy-to-the-cap always dumps the remainder on the final page).
const TOTAL_W = blocks.reduce((n, b) => n + b.weight, 0);
const packWith = (budget) => {
  const out = [];
  let cur = [];
  let w = 0;
  for (const b of blocks) {
    if (w + b.weight > budget && cur.length) {
      out.push(cur);
      cur = [];
      w = 0;
    }
    cur.push(b);
    w += b.weight;
  }
  if (cur.length) out.push(cur);
  return out;
};
const PAGES = packWith(92).length;
let chunks = packWith((TOTAL_W / PAGES) * 1.03);
for (let guard = 0; chunks.length > PAGES && guard < 12; guard++) {
  chunks = packWith((TOTAL_W / PAGES) * (1.03 + 0.03 * (guard + 1)));
}

const blockHtml = (b) => `<div class="scr">
  <h3>${esc(b.s)}${b.cont ? ' <span class="ct">cont.</span>' : ''}<em>${b.rows.length}</em></h3>
  ${b.rows
    .map(
      (r) =>
        `<p class="act"><b>${esc(r.a)}</b>${
          r.t === 'public' ? '' : ` <span class="pill ${r.t}">${TIERS[r.t]}</span>`
        } &mdash; ${esc(r.d)}</p>`,
    )
    .join('')}
</div>`;

const invPages = chunks.map((c, i) =>
  page(
    `${
      i === 0
        ? `<h2><span class="n">04</span>The full inventory</h2>
           <p class="sub">${ITEMS.length} actions across ${screens.length} screens, in sidebar order. Unbadged&nbsp;=&nbsp;every account.</p>`
        : `<h2><span class="n">04</span>The full inventory <span style="font-size:9pt;color:var(--muted);font-weight:600">&nbsp;cont.</span></h2>`
    }
     <div class="inv">${c.map(blockHtml).join('')}</div>`,
  ),
);

/* ── closing page ─────────────────────────────────────────────────────── */
const tierRows = [
  ['Everyone', count('public'), 'Any signed-in, invited account. The whole creation pipeline: styles, characters, scripts, voices, renders, the editor, Library, shorts, publishing, billing, teams, API keys, the global rulebook and their own rules.'],
  ['Studio', count('studio'), 'An email allowlist. Adds the Voice Tuner and sample gallery, Script Review with its own approval gate and publish panel, Dictate, Course Studio, the house rulebook and canon cast editing, and the settlement view.'],
  ['Owner', count('owner'), 'The operator account. Autopilot, the pipeline observer, the Discord copilot, unattended RSS renders, the publish queue and live cost surfacing.'],
  ['Admin', count('admin'), 'Site admins only. Read-only support sessions (the customer sees a banner and every write is blocked) and minting beta invites.'],
  ['API key', count('api'), 'Machine access: script in, finished video out, no approval gate, ten per hour, plus list, status and an MCP manifest so an agent can drive it.'],
];

const pEnd = page(`
  <h2><span class="n">05</span>Who gets what</h2>
  <table class="tiers">
    <tr><th>Tier</th><th style="text-align:right">Actions</th><th>What it adds</th></tr>
    ${tierRows.map(([t, n, d]) => `<tr><td><b>${t}</b></td><td class="n">${n}</td><td>${d}</td></tr>`).join('')}
  </table>

  <h2 style="margin-top:12pt"><span class="n">06</span>Honest gaps</h2>
  <p class="sub">Found in the same sweep. None is a blocker; all three are things a customer can hit.</p>
  <div class="box red">
    <p><b>Deleting a video is permanent.</b> There is no trash, archive or undo &mdash; the confirm dialog is the only
    safety net. A soft-delete with a restore window is the obvious fix.</p>
  </div>
  <div class="box blue">
    <p><b>No customer-facing ticket endpoint.</b> Fable&nbsp;5 status is read off the project row rather than a
    dedicated status route, so the editor card and Project History are the only places a customer sees it.</p>
  </div>
  <div class="box">
    <p><b>One dead share path.</b> The legacy <code>share</code> lane records the intent but performs no upload; the
    working paths are the Library share modal and the Publishing screen. It should be removed rather than left to
    look functional.</p>
  </div>

  <h2 style="margin-top:12pt"><span class="n">07</span>Keeping this doc true</h2>
  <p>The list lives in <code>scripts/briefs/data/jelly-studio-actions.json</code> &mdash; one object per action with
  screen, title, tier and description. Add features there and re-run
  <code>node scripts/briefs/build-jelly-capabilities-doc.mjs</code> to rebuild this PDF; the page breaks re-flow on
  their own. The searchable web version of the same data is linked from the Docs menu entry.</p>
  <p class="small" style="margin-top:10pt;color:var(--muted)">Compiled 2026-08-25 from the shipped code: every screen
  under <code>components/animate/screens/**</code>, the seven editor steps, the create-video flow, and all routes under
  <code>app/api/vater/**</code> and <code>app/api/v1/**</code>. Tier gates read from
  <code>lib/vater/nav-visibility.ts</code>, <code>lib/admin-auth.ts</code> and the capability flags on
  <code>/api/vater/me</code>.</p>
`);

/* ── render ───────────────────────────────────────────────────────────── */
const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Jelly Studio — Capability Map</title><style>${CSS}${EXTRA}</style></head>
<body>${p1}${p2}${invPages.join('')}${pEnd}</body></html>`;

writeFileSync(OUT_HTML, html);

const browser = await chromium.launch();
const pg = await browser.newPage();
await pg.setContent(html, { waitUntil: 'load' });
await pg.pdf({ path: OUT_PDF, format: 'Letter', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();
console.log(`${PAGE} pages → ${OUT_PDF}`);
