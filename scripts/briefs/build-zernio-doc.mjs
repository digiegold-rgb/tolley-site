/**
 * Zernio × Tolley — how our social-publishing vendor works, 100% for OUR
 * use case (tolley.io + tolley.io/animate). No generic API-doc padding.
 *
 *   node scripts/briefs/build-zernio-doc.mjs
 *
 * US-Letter navy/gold brief in the lady-video house style, rendered to
 * public/research/zernio-integration-2026-08.pdf.
 *
 * Every endpoint, price, limit and gotcha in here was read off
 * docs.zernio.com, lib/vater/social-vendor/zernio.ts, the zernio webhook
 * route, ~/growth-engine/lib/zernio_{admin,publisher}.py and a live
 * GET /accounts on 2026-08-19.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const CSS = readFileSync('/home/jelly/tolley-site/scripts/briefs/lady-video-system.css', 'utf8');
const OUT_HTML = '/home/jelly/tolley-site/scripts/briefs/zernio-integration-2026-08.html';
const OUT_PDF = '/home/jelly/tolley-site/public/research/zernio-integration-2026-08.pdf';

let PAGE = 0;
const page = (body) => {
  PAGE++;
  return `<div class="page"><div class="pinner">${body}</div>
    <div class="footer"><span>Zernio × Tolley — one social API under tolley.io &amp; /animate</span><span>tolley.io/hq · Aug 19, 2026 · p${PAGE}</span></div>
  </div>`;
};

/* ───────────────────────────────────────────── 1. cover + mental model ── */
const p1 = page(`
  <div class="cover-band">
    <div class="v2tag">INTEGRATION DOC</div>
    <div class="kicker">HQ · Docs · Engineering brief</div>
    <h1>Zernio &times; Tolley</h1>
    <div class="date">The one social-publishing vendor under tolley.io and tolley.io/animate — what we use, what we skip, what it costs · August 19, 2026</div>
  </div>

  <p class="lede">Zernio (formerly Late / getlate.dev) is a <b>unified social-media API</b>: one key, 16 platforms,
  hosted OAuth, one <code>POST /posts</code>. We use exactly <b>two slices</b> of it — customer publishing inside
  <b>/animate</b> and Jared's <b>own channels</b> replacing three fragile browser-automation stacks. Everything else
  it sells (unified inbox, SMS/WhatsApp numbers, ads manager, comment-to-DM workflows) we deliberately do not use.
  This doc is the whole integration on four pages.</p>

  <div class="tiles five">
    <div class="tile goldtop"><div class="num">1</div><div class="lbl">team API key<br><code>ZERNIO_API_KEY</code> — both lanes share it</div></div>
    <div class="tile"><div class="num">2</div><div class="lbl">lanes<br>/animate customers · Jared's channels</div></div>
    <div class="tile purpletop"><div class="num">6+1</div><div class="lbl">platforms routed<br>TT·IG·FB·Pin·X·LI + YouTube native</div></div>
    <div class="tile greentop"><div class="num">18</div><div class="lbl">owner accounts<br>connected &amp; active today</div></div>
    <div class="tile"><div class="num">$12</div><div class="lbl">free credit / month<br>≈ 2 accounts before billing starts</div></div>
  </div>

  <h2><span class="n">01</span>The mental model — four nouns, top down</h2>
  <div class="flow tight">
    <div class="frow"><div class="fnum">TEAM<small>our key</small></div>
      <div class="fbody"><div class="ft">One team = our <code>sk_…</code> API key</div>
      <div class="fd">Billing pool, rate-limit budget and every profile below hang off this ONE key. Base URL <b>https://zernio.com/api/v1</b>, <code>Authorization: Bearer</code>. Same key in Vercel prod and <code>~/.config/zernio/env</code>.</div></div></div>
    <div class="farrow">▼ contains</div>
    <div class="frow"><div class="fnum">PROFILE<small>a folder</small></div>
      <div class="fbody"><div class="ft">Profile = a named folder of accounts (24-char Mongo id)</div>
      <div class="fd"><b>/animate:</b> one profile per customer, auto-created as <code>animate_&lt;userId&gt;</code>, id stored in <code>VaterSocialProfile</code>. <b>Owner lane:</b> Jared's hand-made profiles in the dashboard — Ruthann, Your KC Homes, Cordless, Businesss, Jelly Studio, WD Business, Estate Sales.</div></div></div>
    <div class="farrow">▼ contains</div>
    <div class="frow"><div class="fnum">ACCT<small>a login</small></div>
      <div class="fbody"><div class="ft">Account = one connected social login — the thing posts target</div>
      <div class="fd">Born from a hosted-OAuth click. Mirrored into OUR db: <code>SocialAccount</code> rows (<code>provider='zernio'</code>, <code>externalAccountId</code>) for /animate; <code>~/.config/zernio/accounts.json</code> for the owner lane. Health flags: <code>isActive</code>, <code>needsReconnection</code>.</div></div></div>
    <div class="farrow">▼ targeted by</div>
    <div class="frow"><div class="fnum">POST<small>the work</small></div>
      <div class="fbody"><div class="ft">Post = one <code>POST /posts</code> fanned out to N accountIds</div>
      <div class="fd">Video by public URL (<code>mediaItems:[{type:'video',url}]</code>), per-platform targets + quirks, <code>publishNow</code> or <code>scheduledFor</code>+<code>timezone</code>, idempotent via <code>x-request-id</code>. Status flows back over ONE webhook.</div></div></div>
  </div>

  <div class="box red"><div class="bt">The one security rule that is OURS, not Zernio's</div>
  <p>Zernio validates an <code>accountId</code> against the <b>whole team</b>, not against a profile. If we ever pass customer B's accountId while acting for customer A, Zernio will happily post. The profile↔user and account↔user mapping lives in <b>our</b> database — every publish route must check <code>SocialAccount.userId</code> before calling the vendor.</p></div>
`);

/* ─────────────────────────────────── 2. lane 1: /animate customers ────── */
const p2 = page(`
  <h2><span class="n">02</span>Lane 1 — /animate customers connect their own socials</h2>
  <p class="sub">The product lane. Every /animate user connects their OWN TikTok / Instagram / Facebook / Pinterest / X / LinkedIn and publishes finished MP4s from the publish panel. Chosen 2026-08-17 over Ayrshare ($599/mo for multi-user) and over native OAuth (5 separate platform app reviews).</p>

  <div class="flow tight">
    <div class="frow"><div class="fnum">1</div>
      <div class="fbody"><div class="ft">Connect click → profile exists</div>
      <div class="fd"><code>ensureProfileForUser()</code> — <code>POST /profiles</code> name <code>animate_&lt;userId&gt;</code> with <code>Idempotency-Key</code>; on 409 it looks the profile up by exact name. Row upserted into <code>VaterSocialProfile</code>.</div>
      <div class="fmeta">lib/vater/social-vendor/zernio.ts · profile names are unique per team</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">2</div>
      <div class="fbody"><div class="ft">Hosted OAuth — Zernio does the consent screens</div>
      <div class="fd"><code>GET /connect/{platform}?profileId&amp;redirect_url</code> → <code>authUrl</code>. Zernio runs the platform consent plus any picker (FB page, IG account, Pinterest board, LinkedIn org), then 302s back to our callback. <code>force=true</code> re-runs OAuth for a reconnect. <b>Links embed a timestamp and EXPIRE — always generate fresh, never store or re-send one.</b></div>
      <div class="fmeta">app/api/vater/social-accounts/oauth/[platform]/start → callback</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">3</div>
      <div class="fbody"><div class="ft">Callback → mirror accounts into our DB</div>
      <div class="fd"><code>syncAccountsForUser()</code> — <code>GET /accounts?profileId</code>, upsert <code>SocialAccount</code> rows (status active / expired / error from <code>needsReconnection</code>/<code>isActive</code>), delete vendor rows the vendor no longer reports. Never touches native YouTube rows. UI lands on <code>/animate?social=connected#r=publishing</code>.</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">4</div>
      <div class="fbody"><div class="ft">Publish click → one createVideoPost()</div>
      <div class="fd"><code>POST /posts</code>: caption, <code>mediaItems:[{type:'video', url: finalVideoUrl}]</code>, <code>platforms:[{platform, accountId, platformSpecificData, customContent}]</code>, <code>publishNow:true</code> (or <code>scheduledFor</code> + IANA <code>timezone</code>), header <code>x-request-id</code> = stable id per (project, click) so a double-click can't double-post — the API returns <code>existingPost</code> instead.</div>
      <div class="fmeta">app/api/vater/youtube/[id]/publish-social · ledger row: VaterSocialPost</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">5</div>
      <div class="fbody"><div class="ft">Status comes back over the webhook, not polling</div>
      <div class="fd"><code>POST https://www.tolley.io/api/webhooks/zernio</code> — HMAC-SHA256 of the raw body vs <code>X-Zernio-Signature</code> (refuses unsigned traffic), in-process dedupe on event id. Handles <code>post.published / partial / failed / cancelled / scheduled / post.platform.* / post.tiktok.url_resolved / account.connected / account.disconnected</code> → updates <code>VaterSocialPost</code> + re-syncs accounts. "Your posts" on the Publishing screen reads that ledger; <code>GET /posts/{id}</code> is the manual-refresh fallback.</div></div></div>
  </div>

  <div class="cols3">
    <div class="box gold"><div class="bt">Per-platform quirks we handle</div>
    <p><b>X:</b> <code>customContent</code>, first 270 chars. <b>Pinterest:</b> needs <code>boardId</code> — boards via <code>GET /accounts/{id}/pinterest-boards</code>. <b>TikTok:</b> <code>privacy_level</code> + <code>content_preview_confirmed</code> / <code>express_consent_given: true</code> in top-level <code>tiktokSettings</code>; options from <code>…/tiktok-creator-info</code>.</p></div>
    <div class="box blue"><div class="bt">YouTube stays native</div>
    <p>YouTube never touches Zernio — our own per-user Google OAuth (<code>oauth/youtube/*</code>). The publish panel fans one click out to native YT + Zernio platforms together.</p></div>
    <div class="box red"><div class="bt">Two hard rules</div>
    <p>The MP4 must be a <b>public https Blob URL</b> — Zernio fetches it itself; DGX-tunnel links 409. And <b>nothing posts without the user's click</b> — no autonomous sends, ever.</p></div>
  </div>

  <div class="box"><div class="bt">Env (Vercel prod + .env.local)</div>
  <p><code>ZERNIO_API_KEY</code> (sk_… team key) · <code>ANIMATE_SOCIAL_VENDOR=zernio</code> (feature flag — unset disables the whole lane) · <code>ZERNIO_WEBHOOK_SECRET</code> (HMAC). Migration <code>20260817_social_vendor</code>; webhook registration id <code>6a8390586ee5c447bf023243</code>.</p></div>
`);

/* ────────────────────────────────── 3. lane 2: Jared's own channels ───── */
const p3 = page(`
  <h2><span class="n">03</span>Lane 2 — Jared's own channels (browser stacks → API)</h2>
  <p class="sub">Goal: retire the three fragile posting stacks — Selenium Pinterest (:9107/:9108), Selenium+Xvfb TikTok (:9106), Playwright LinkedIn — by routing those lanes through the same team key. Connects were completed 2026-08-19: <b>18 active accounts, zero needing reconnection.</b></p>

  <div class="box gold"><div class="bt">⚠ Where the accounts actually live (this bit surprised us)</div>
  <p>Jared connected everything under profiles he made himself in the Zernio dashboard — <b>not</b> under the CLI's <code>owner_jared</code> profile, which sits empty. So <code>zernio_admin.py accounts</code> (profile-scoped) says "none connected"; the truth comes from team-wide <code>GET /accounts</code>. Automation must post with each account's <b>real</b> profileId from <code>accounts.json</code> — never assume one owner profile.</p></div>

  <div class="cols2">
    <div>
      <h3 class="first">The 18 connected accounts, by profile</h3>
      <div class="kv">
        <dt>Businesss</dt><dd>TikTok @yourkchomes</dd>
        <dt>Ruthann</dt><dd>Pinterest @digiegold · TikTok @ruthanntreasurehauls · FB RuthannsTreasureHaul · IG ruthanntolley · YT ruthanntreasures</dd>
        <dt>Your KC Homes</dt><dd>Pinterest yourkchomes · FB page · YT yourkchomes · Meta Ads</dd>
        <dt>Cordless</dt><dd>LinkedIn Jared Tolley · TikTok digitaljared · YT digitalgold</dd>
        <dt>Jelly Studio</dt><dd>FB page · YT digitalgold-diggers · Meta Ads</dd>
        <dt>WD Business</dt><dd>FB Wash &amp; Dry Rental — Kansas City</dd>
        <dt>Estate Sales</dt><dd>FB Tolley Estate Sales</dd>
      </div>
      <p class="small">LinkedIn: the Your-KC-Homes <i>page</i> posts ride the personal token's <code>w_organization_social</code> scope — one account row covers both.</p>
    </div>
    <div>
      <h3 class="first">The tooling (DGX-side, no site code)</h3>
      <ul>
        <li><b><code>~/growth-engine/lib/zernio_admin.py</code></b> — ensure-profile · <code>connect &lt;platform&gt;</code> (prints fresh hosted-OAuth URL) · <code>accounts --write</code> · <code>boards &lt;key&gt;</code> · <code>post-status &lt;id&gt;</code>.</li>
        <li><b><code>~/growth-engine/lib/zernio_publisher.py</code></b> — <code>post(account_key, caption=, media_url=|image_url=, board_id=, link=, title=, request_id=)</code>. <b>DRY-RUN unless <code>ZERNIO_PUBLISH=1</code></b>; every send appended to <code>~/growth-engine/state/zernio-posts.jsonl</code>.</li>
        <li><b><code>~/.config/zernio/accounts.json</code></b> (0600) — stable keys → real ids: <code>pinterest_main</code>, <code>pinterest_treasure</code>, <code>tiktok_kchomes</code>, <code>tiktok_ruthann</code>, <code>linkedin_jared</code> (+13 extras under <code>unmatched_extra</code>).</li>
        <li><b><code>~/.config/zernio/env</code></b> (0600) — same team key as tolley-site.</li>
      </ul>
    </div>
  </div>

  <h3>Phase 3 — lane-by-lane cutover (unblocked, not started)</h3>
  <div class="flow tight">
    <div class="frow"><div class="fnum">3a</div>
      <div class="fbody"><div class="ft">Flag, don't rewrite</div>
      <div class="fd">Each posting lane gets <code>PUBLISH_VIA=zernio|browser</code>; the browser path stays as fallback for 7 days per lane. Order: pin-featured → pin-circle → pin-haul/treasure-pins → retire the duplicate <code>pinterest-cron-post</code> cron → re-enable <code>LISTINGS_PINTEREST</code> → housing-hub LinkedIn → shorts TikTok leg → ruthann-repost (keeps its ramp/cap).</div></div></div>
    <div class="farrow">▼</div>
    <div class="frow"><div class="fnum">3b</div>
      <div class="fbody"><div class="ft">Phase 4 — turn the browsers off</div>
      <div class="fd">After 14 clean days: disable :9106/:9107/:9108 services + tiktok-session-watchdog. <b>Not moving:</b> FB / YT / IG / Bluesky legs, Marketplace, YT Community posts (no public API exists), tt-personal-picks (draft-gated).</div></div></div>
  </div>
`);

/* ─────────────────────────────── 4. money, limits, rules, gotchas ─────── */
const p4 = page(`
  <h2><span class="n">04</span>What it costs — one pool for both lanes</h2>
  <div class="cols2">
    <div>
      <div class="box blue"><div class="bt">Per connected account, graduated + prorated daily</div>
      <p><b>$6</b> first tier → <b>$3</b> → <b>$1</b> per account-month, applied to the TEAM total (billable units = all account-days ÷ days in month), not per individual account. Daily proration: a $6 account connected 15 of 30 days costs $3. <b>$12 free credit each calendar month</b> ≈ two baseline accounts. Card auto-charges when accrued usage hits a threshold that starts at $10 and doubles.</p></div>
      <div class="box gold"><div class="bt">What this means for us</div>
      <p>Owner accounts and every /animate customer's accounts <b>share one billing pool and one rate-limit budget</b> on the single team key. Zernio bills per connected account, <b>never per post</b> — so no per-post cost is booked onto Vater render cards. A <code>402 PAYMENT_REQUIRED</code> anywhere = team-level billing alarm, not a customer problem.</p></div>
    </div>
    <div>
      <div class="box"><div class="bt">Rate limits (scale with connected accounts)</div>
      <p><b>0–2</b> accounts → 60 req/min · <b>3–2,000</b> → 600 req/min · <b>2,001+</b> → 1,200 req/min. We're in the 600 tier. Honor <code>Retry-After</code> on 429. Prefer the webhook over polling — polling burns this budget.</p></div>
      <div class="box"><div class="bt">Webhook delivery contract</div>
      <p>Respond <b>2xx within 5s</b> or Zernio retries on exponential backoff — 7 attempts (10s → 100s → ~17m → ~2.8h → 24h×2) then dead-letter. Delivery is <b>at-least-once</b>: dedupe on the event <code>id</code> / <code>X-Zernio-Event-Id</code>. <code>attemptNumber</code> tells you which retry you're seeing.</p></div>
    </div>
  </div>

  <h2><span class="n">05</span>The gotcha list — every one already cost us time</h2>
  <ul>
    <li><b>Always <code>www.tolley.io</code> for the webhook</b> — the apex 301 redirect eats POST bodies.</li>
    <li><b>Webhook registration endpoint is <code>/v1/webhooks/settings</code></b>, not <code>/v1/webhooks</code>. Up to 10 endpoints per team.</li>
    <li><b>Hosted-OAuth connect links expire</b> (timestamp baked in). Generate at click-time; a stored link in an /hq item or doc will be dead.</li>
    <li><b><code>accountId</code> is validated team-wide</b> — tenant isolation is our server-side check, page 1.</li>
    <li><b>Media is fetch-by-URL</b> — the MP4/image must be publicly reachable https (Vercel Blob). Private or tunneled URLs fail the post.</li>
    <li><b>Offboarding a customer:</b> <code>DELETE /accounts/{id}</code> per account, then <code>DELETE /profiles/{id}</code>. Disconnected accounts can be moved between profiles, never silently deleted.</li>
    <li><b>Scoped API keys exist</b> (<code>POST /api-keys</code>, scope <code>profiles</code> + <code>profileIds</code>, read/write, optional expiry) — the right tool if we ever hand a tenant or a contractor direct API access. Nobody has one today.</li>
    <li><b>Zernio's "AI providers" page is not for us</b> — it powers their comment→DM workflow bots only. Captions are generated DGX-side. If ever used: a fresh spend-capped Anthropic key, never the tolley-site/OpenClaw keys.</li>
    <li><b>Nothing posts autonomously</b> — /animate posts happen on the customer's click; owner-lane posts stay DRY-RUN until <code>ZERNIO_PUBLISH=1</code> and Jared has approved the lane.</li>
  </ul>

  <h3>Sources</h3>
  <p class="small">docs.zernio.com (multi-tenant, webhooks, billing) fetched 2026-08-19 · <code>lib/vater/social-vendor/zernio.ts</code> · <code>app/api/webhooks/zernio/route.ts</code> · <code>~/growth-engine/lib/zernio_admin.py</code> / <code>zernio_publisher.py</code> · live team-wide <code>GET /accounts</code> 2026-08-19 (18 active) · memory: animate-zernio-social-publishing, zernio-owner-lane. Prices/limits are Zernio's published numbers on the fetch date — re-check the Pricing page before capacity planning.</p>
`);

/* ─────────────────────────────────────────────────────── build ── */
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Zernio × Tolley — the social-publishing integration, end to end</title>
<style>${CSS}</style>
</head>
<body>
${p1}${p2}${p3}${p4}
</body>
</html>`;

writeFileSync(OUT_HTML, html);
console.log('html written:', OUT_HTML, (html.length / 1e3).toFixed(0) + ' KB');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
await p.goto('file://' + OUT_HTML, { waitUntil: 'networkidle' });
await p.emulateMedia({ media: 'print' });
for (let pass = 0; pass < 3; pass++) {
  const shrunk = await p.evaluate(() => {
    const LIMIT = 11 * 96;
    const out = [];
    for (const el of document.querySelectorAll('.page')) {
      const inner = el.querySelector('.pinner');
      const PAD = (0.5 + 0.58) * 96;
      const cur = parseFloat(inner.style.zoom || '1');
      const h = inner.getBoundingClientRect().height / cur;
      if (h * cur > LIMIT - PAD - 6) {
        const z = Math.max(0.78, (LIMIT - PAD - 10) / h);
        inner.style.zoom = String(z);
        out.push({ page: [...document.querySelectorAll('.page')].indexOf(el) + 1, zoom: +z.toFixed(3) });
      }
    }
    return out;
  });
  if (!shrunk.length) break;
  if (pass === 0) console.log('auto-fit zoom applied:', JSON.stringify(shrunk));
}
const fit = await p.evaluate(() => {
  const LIMIT = 11 * 96;
  return [...document.querySelectorAll('.page')].map((el, i) => ({
    page: i + 1,
    zoom: +(parseFloat(el.querySelector('.pinner').style.zoom || '1')).toFixed(3),
    h: Math.round(el.getBoundingClientRect().height),
    over: Math.round(el.getBoundingClientRect().height - LIMIT),
    clipped: el.scrollHeight > el.clientHeight + 1,
  }));
});
console.table(fit);
const bad = fit.filter((f) => f.over > 0 || f.clipped);
console.log(bad.length ? 'OVERFLOW: ' + JSON.stringify(bad) : 'ALL PAGES FIT');
await p.pdf({ path: OUT_PDF, format: 'Letter', printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' } });
await b.close();
console.log('pdf written:', OUT_PDF);
