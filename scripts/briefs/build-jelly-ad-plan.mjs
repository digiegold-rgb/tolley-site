/**
 * Jelly! Studio feature ad — Lady V2, 28 segments — plan of record for /hq → Docs.
 *
 *   node scripts/briefs/build-jelly-ad-plan.mjs
 *
 * Same navy/gold brief stock as the Lady V2 doc (lady-video-system.css), images base64-inlined,
 * auto-fit per page, renders to public/research/jelly-ad-plan-2026-09.pdf.
 * Source of truth for the numbers: ~/growth-engine/cinema/projects/jelly-ad-01/{build_shotlist.py,shotlist.json}
 * and ~/.claude/plans/i-wanna-make-an-serene-milner.md (research 2026-09-01).
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CSS = readFileSync('/home/jelly/tolley-site/scripts/briefs/lady-video-system.css', 'utf8');
const OUT_HTML = '/home/jelly/tolley-site/scripts/briefs/jelly-ad-plan-2026-09.html';
const OUT_PDF = '/home/jelly/tolley-site/public/research/jelly-ad-plan-2026-09.pdf';
const PROJ = '/home/jelly/growth-engine/cinema/projects/jelly-ad-01';
const REFS = '/home/jelly/growth-engine/shorts/persona-refs';

const img = (p) => {
  if (!existsSync(p)) return '';
  const mime = p.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
};
const pic = (p, cap, h = 150) => {
  const d = img(p);
  return d ? `<div class="frame"><img src="${d}" style="height:${h}pt;width:auto;object-fit:cover"><div class="fcap">${cap}</div></div>` : '';
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const shotlist = JSON.parse(readFileSync(`${PROJ}/shotlist.json`, 'utf8'));
const clips = shotlist.clips;
const totalS = clips.reduce((a, c) => a + c.seconds, 0);
const usd = (res, rate1k) => clips.reduce((a, c) => a + c.seconds, 0); // placeholder for sum seconds
const tok = { '480p': 480 * 864, '720p': 720 * 1280, '1080p': 1080 * 1920, '4k': 2160 * 3840 };
const rate = { mini: 0.00716, std: 0.014, k4: 0.008 };
const cost = (res, r) => (tok[res] * 24 / 1024) * totalS / 1000 * r;
const C480 = cost('480p', rate.mini), C720 = cost('720p', rate.std), C1080 = cost('1080p', rate.std), C4K = cost('4k', rate.k4);
const $ = (n) => '$' + n.toFixed(0);

let PAGE = 0;
const page = (body) => {
  PAGE++;
  return `<div class="page"><div class="pinner">${body}</div>
    <div class="footer"><span>Jelly! Studio feature ad — Lady V2, 28 segments — plan of record</span><span>tolley.io/hq · Sep 1, 2026 · p${PAGE}</span></div>
  </div>`;
};

/* ───────── 1. cover + the post-mortem that changed the brief ───────── */
const p1 = page(`
  <div class="cover-band">
    <div class="v2tag">AD PLAN · LADY V2</div>
    <div class="kicker">HQ · Docs · Production plan</div>
    <h1>"I'm completely generated on Jelly Studio"</h1>
    <div class="date">A 4-minute feature film in 28 independent segments, cut into every ad we need · September 1, 2026</div>
  </div>

  <p class="lede">Lady walks one bright creator loft and names the top features of Jelly!&nbsp;Studio, one feature per
  segment, each segment a complete sentence with its own visual. The long cut is a straight concat. The 15-second
  reels are the same segments, un-cut. <b>Nothing is rendered twice</b>, every scene is proofed as a cheap still-motion
  take before the premium pass, and the premium pass is <b>native 1080p</b> Seedance 2.0 on the Lady V2 lane.</p>

  <div class="tiles five">
    <div class="tile goldtop"><div class="num">28</div><div class="lbl">segments<br>8–12 s each</div></div>
    <div class="tile"><div class="num">${totalS}s</div><div class="lbl">requested<br>≈ 4:20 long cut</div></div>
    <div class="tile purpletop"><div class="num">1080p</div><div class="lbl">native, 9:16<br>Seedance 2.0 std</div></div>
    <div class="tile greentop"><div class="num">${$(C1080)}</div><div class="lbl">one take, all 28<br>+ ${$(C480)} proof pass</div></div>
    <div class="tile redtop"><div class="num">~$240</div><div class="lbl">all in, with 25%<br>retakes — cap ask</div></div>
  </div>

  <h3>What the post-mortem of the first Lady V2 film changed</h3>
  <div class="cols2">
    <div>
      <div class="box red">
        <p><b>"Cartoony" was never the Lady lane.</b> The 8-minute capability reel (Aug 26) intercut photoreal Lady
        clips with two Pixar-style 3D clips from the customer Vater lane (<code>v05</code>, <code>v09a</code>). Viewers graded
        the whole reel down. This ad contains no customer-lane footage — UI proof is real screen capture, inset in post.</p>
      </div>
      <div class="box blue">
        <p><b>Nothing Lady has ever shipped was above 720p.</b> All 26 paid generations of the estate proof were 720p; the
        capability reel's 1080p was title cards around 720p clips. The 1440p ESRGAN upscale was rejected on the couch test
        ("looks about the same"). Premium here means <b>native 1080p</b>, not an upscale.</p>
      </div>
    </div>
    <div>
      <div class="box gold">
        <p><b>The two best-looking shots had a different style string.</b> c05 and c08 were hand-switched to
        <i>"Photoreal, shot on a full-frame cinema camera, 35mm look"</i> and c08 scored the best identity in the project
        (ArcFace 0.907). That head is now the default for this ad, with the anti-CG clause that until now lived only in the
        character-sheet template: <i>"Not a 3D render, not CG, not smoothed or filtered."</i></p>
      </div>
      <div class="box">
        <p><b>Where the 26-for-8 rework went:</b> bust-only @Image1 invented her lower half (~$9) · voice engine flipped
        after clip 1 ($19) · ArcFace noise on wide frames · one prop/blocking miss each · judge pedantry. All four are now
        defaults in code, and this project adds a proof pass at 480p before any 1080p call.</p>
      </div>
    </div>
  </div>
`);

/* ───────── 2. resolution + pricing ───────── */
const p2 = page(`
  <h2>Premium means native 1080p. Here is why not 4K.</h2>
  <table>
    <tr><th>fal endpoint</th><th>res</th><th>$/s</th><th>note</th></tr>
    <tr><td>seedance-2.0 reference-to-video (Lady V2)</td><td>720p</td><td>$0.302</td><td>what shipped in August</td></tr>
    <tr><td><b>seedance-2.0 reference-to-video</b></td><td><b>1080p</b></td><td><b>$0.680</b></td><td>the documented "if resolution matters" path</td></tr>
    <tr><td>seedance-2.0 reference-to-video</td><td>4K</td><td>~$1.56</td><td>fal's page lists only 480/720/1080; unverified; platforms re-encode to ≤1080p anyway</td></tr>
    <tr><td>seedance-2.0 mini</td><td>480p</td><td>$0.070</td><td>proofing tier — every segment goes here first</td></tr>
    <tr><td>seedance-2.5 reference-to-video</td><td>≤720p</td><td>$0.473</td><td>30 s clips, 50 refs, no 1080p</td></tr>
    <tr><td>Kling 3.0 4K image-to-video</td><td>4K</td><td>$0.42</td><td>no native lip-synced dialogue → breaks the voice spine</td></tr>
    <tr><td>Veo 3.1 4K with audio</td><td>4K</td><td>$0.60</td><td>no reference-audio timbre lock → a different voice</td></tr>
    <tr><td>Topaz upscale on fal</td><td>→4K</td><td>$0.08</td><td>doctrine: never upscale AI output (tested, rejected Aug 22)</td></tr>
  </table>

  <div class="cols2">
    <div>
      <h3>Cost of the 28 segments (${totalS} s, 9:16)</h3>
      <table>
        <tr><th>tier</th><th>one take</th><th>+ proof + 25% retakes</th></tr>
        <tr><td>480p mini (proof only)</td><td>${$(C480)}</td><td>—</td></tr>
        <tr><td>720p standard</td><td>${$(C720)}</td><td>${$(C720 + C480 + C720 * 0.25 + 3)}</td></tr>
        <tr><td><b>1080p standard (recommended)</b></td><td><b>${$(C1080)}</b></td><td><b>${$(C1080 + C480 + C1080 * 0.25 + 3)}</b></td></tr>
        <tr><td>4K (if the endpoint accepts it)</td><td>${$(C4K)}</td><td>${$(C4K + C480 + C4K * 0.25 + 3)}</td></tr>
      </table>
      <p class="small">Sheet + six location plates ≈ $3 (Gemini image). Screen captures, assembly, captions, music, endcards: $0.
        Historical yield was 2.75 generations per shipped shot; with the four fixes and a proof pass the target is 1.25.</p>
    </div>
    <div>
      <h3>What "premium" actually buys on a phone</h3>
      <div class="box gold">
        <p>Every platform this runs on (Reels, Shorts, TikTok, X) delivers ≤1080p and re-encodes. 4K costs 2.3× and is
        invisible after the transcode. What viewers <i>will</i> see: the cinema-camera style head, true skin texture, a
        consistent lit set on every cut, zero wardrobe drift, and 1080p pixels under the platform's encoder instead of 720p.</p>
      </div>
      <div class="box blue">
        <p><b>Spend gates.</b> Proof pass runs under the default $60 cap. The 1080p pass needs <code>CINEMA_MAX_USD</code> raised
        to the number Jared names (~$260) and the fal balance checked first — an exhausted balance surfaces as a 403 on
        the storage upload, not on submit (the 6.5-hour stall of Aug 22).</p>
      </div>
    </div>
  </div>
`);

/* ───────── 3. production design ───────── */
const p3 = page(`
  <h2>Production design — the drift-killers</h2>
  <div class="cols2">
    <div>
      ${pic(`${PROJ}/doc-img/sheet.jpg`, '<b>Fit jelly-a</b> — violet ribbed knit, black wide-leg trousers, white sneakers. Trousers, so a chest-up selfie can never be judged "top vs dress". Built Sep 1; bust ArcFace 0.944, front 0.943. Regenerate by ~Sep 26 (30-day face window).', 120)}
      <div class="box">
        <p><b>Refs on every generation:</b> @Image1 <code>pack/jelly-a/front.png</code> (full body, face-locked — the wardrobe anchor) ·
        @Image2 <code>bust.png</code> · @Image3 <code>identity/front.jpg</code> · <b>@Image4 the zone's location plate</b> (new) ·
        @Audio1 <code>voice/lady-anchor.wav</code> (timbre only). <code>generate_audio: true</code>.</p>
      </div>
      <div class="box gold">
        <p><b>Style head:</b> Photoreal, full-frame cinema camera, 35mm lens look, shallow depth of field, natural window light with
        soft fill, true skin texture and visible freckles, real fabric weight, 9:16. Not a 3D render, not CG, not smoothed or filtered.<br>
        <b>Identity head:</b> "The character in @Image1 (full-body reference — same face as @Image2 and @Image3; same outfit head to toe:
        &lt;wardrobe&gt; in every shot)." Her face, hair and age are never described in words.<br>
        <b>Speech:</b> "She says exactly: "…" Use @Audio1 as her voice and timbre reference only; she speaks the quoted line exactly
        once, naturally, no echo, no repeated reads."<br>
        <b>Tail:</b> "No captions, no subtitles, no on-screen text, no lettering on props or screens, no watermark."</p>
      </div>
    </div>
    <div>
      <div class="frow">
        ${pic(`${PROJ}/doc-img/A.jpg`, 'Zone A — window', 130)}
        ${pic(`${PROJ}/doc-img/B.jpg`, 'Zone B — desk', 130)}
        ${pic(`${PROJ}/doc-img/D.jpg`, 'Zone D — hallway', 130)}
      </div>
      <p class="small"><b>One set, six zones, six people-free plates</b> (A window · B desk · C sofa · D hallway · E doorway · F desk close),
      generated once with Gemini image and passed as @Image4 so 28 independent generations share one room and one light.
      The S01/S09 proof decides whether the plate stays (if it fights identity, the text description alone carries the room).</p>
      <div class="box blue">
        <p><b>Spoken-word rules.</b> "Jelly Studio" is safe to say. <b>"Tolley" is never spoken</b> — Whisper heard "Tolia" on the
        estate proof — the URL lives on the post-added endcard only. ≤22 words per line, one complete sentence per segment.
        Two-speaker segments (S09) are transcript-checked on <i>both</i> lines (the c05 false alarm cost $3).</p>
      </div>
      <div class="box">
        <p><b>Cut grammar.</b> Universal <b>in</b>: shot 1 opens on a new angle with her already mid-motion. Universal <b>out</b>: she looks into
        the lens, settles into a small smile, holds ~0.6 s. So any segment cuts to any other. No line crosses a seam. Adjacent segments
        share a zone so a hard cut reads as a new angle, never a location jump. Lower-third label ≤4 words, added in post — never karaoke.</p>
      </div>
    </div>
  </div>
`);

/* ───────── 4. the 15 features + UI proof ───────── */
const feats = [
  ['Pay per film', '"Most films: $1–7 all in." No subscription, no watermark, failed renders $0', 'pricing ticket'],
  ['Your script, word for word', '"You hold the pen — the studio only illustrates what you approve."', 'Script Review approve gate'],
  ['Claude writes it', '"Pick Fable, Opus or Sonnet — pay what the writer actually used."', 'Creator Model picker'],
  ['8-step create flow', 'One paid click; exact quote first; nothing renders until Generate', 'step pills → Confirm gate'],
  ['Your voice, cloned', '"so it still sounds like you at minute nine."', 'Voices + Voice Tuner'],
  ['Selfie → art style', 'upload a selfie → art style + matching character in ~10 s', 'Styles wizard'],
  ['Character Lab', '"Mint a cast… without drifting." $0.68 / 3 takes', 'Characters screen'],
  ['Same face every scene', 'IP-Adapter scene consistency, house cast canon', 'editor toggle + 4 stills'],
  ['Stills first, then motion', '"Animate only the shots that earn it. Per scene, priced before you click."', 'stills grid → N × $ modal'],
  ['Motion transfer', 'the character copies a real driver clip, $1.75/clip', 'driver + result split'],
  ['Video Editor, regenerate a scene', 'timeline + scene drawer; Lady regenerates herself, 25¢', 'Video Editor'],
  ['Thumbnails + SEO', 'thumbnails, titles, tags, chapters from your style', 'thumbnail variants'],
  ['Free 9:16 shorts', '15–60 s, $0, no GPU, no watermark', 'Shorts Library'],
  ['Connect 7 platforms + schedule', 'YouTube, TikTok, IG, FB, Pinterest, X, LinkedIn — $6/mo each; Post now / Schedule', 'Publishing + DripScheduler'],
  ['Socials · Studios · Autopilot', '"Winning clips pulse." · ten studios per login · feeds → episode drafts', 'Socials, tab strip, feeds'],
];
const p4 = page(`
  <h2>The 15 features, easiest to most complex, and their on-screen proof</h2>
  <table>
    <tr><th>#</th><th>feature</th><th>site copy / claim</th><th>proof on screen</th></tr>
    ${feats.map((f, i) => `<tr><td>${i + 1}</td><td><b>${esc(f[0])}</b></td><td>${esc(f[1])}</td><td>${esc(f[2])}</td></tr>`).join('')}
  </table>
  <div class="cols2">
    <div>
      <div class="box red">
        <p><b>Never on screen or in voice:</b> Analytics, AI Animation, Affiliate — all <code>stub: true</code> in
        <code>lib/vater/nav-visibility.ts</code>. Say "Socials shows what every clip did after it posted", never "YouTube analytics".
        Do not say "paste a YouTube link and get a video" — the real fork is your own script vs Jelly writes it.</p>
      </div>
      <div class="box">
        <p><b>UI proof is real and free.</b> A read-only Playwright harness (<code>tests/e2e/audit/capture-ad.mjs</code>) logs in,
        blocks every write, and records a short video plus a full-page PNG per studio route at 1440×900 @2×. Insets are composited
        in post by <code>cinema/tools/inset.py</code>: 9:16 puts the UI card in the top 42% while she keeps talking below;
        the 16:9 master puts her 9:16 frame on the left third and the UI on the right two-thirds. One render serves both.</p>
      </div>
    </div>
    <div>
      ${pic(`${PROJ}/doc-img/script-review.jpg`, 'Script Review — captured Sep 1 (feeds S03/S04)', 118)}
      ${pic(`${PROJ}/doc-img/characters.jpg`, 'Characters — captured Sep 1 (feeds S09/S10)', 118)}
    </div>
  </div>
`);

/* ───────── 5–6. the 28 segments ───────── */
const segRows = (from, to) => clips.slice(from, to).map((c) =>
  `<tr><td><b>${c.id.toUpperCase()}</b><br><span class="small">${c.seconds}s · ${c.zone}${c.standalone ? '' : ' · ✗solo'}</span></td>
   <td><b>${esc(c.caption_label)}</b><br>${esc(c.vo)}${c.speakers ? '<br><i>' + esc(c.speakers[1].who) + ': "' + esc(c.speakers[1].line) + '"</i>' : ''}</td>
   <td class="small">${esc(c.post)}</td></tr>`).join('');
const p5 = page(`
  <h2>The 28 segments — act 1–2: who I am, building the film</h2>
  <p class="small">Every segment: 2–3 labelled shots inside one generation, one primary action per shot, camera named, universal in/out.
  Full prompts live in <code>projects/jelly-ad-01/shotlist.json</code> (generated by <code>build_shotlist.py</code>). "✗solo" = not a standalone reel.</p>
  <table><tr><th>seg</th><th>label · her line</th><th>post inset</th></tr>${segRows(0, 14)}</table>
`);
const p6 = page(`
  <h2>The 28 segments — act 3–5: the editor, getting it out there, control and proof</h2>
  <table><tr><th>seg</th><th>label · her line</th><th>post inset</th></tr>${segRows(14, 28)}</table>
`);

/* ───────── 7. cuts + execution + verification ───────── */
const p7 = page(`
  <h2>Every ad comes out of the same 28 renders</h2>
  <div class="cols2">
    <div>
      <table>
        <tr><th>cut</th><th>segments</th><th>≈ length</th></tr>
        <tr><td>Full feature film, 16:9 (YouTube, site)</td><td>S01–S28</td><td>4:20</td></tr>
        <tr><td>Full, 9:16 (TikTok / Reels)</td><td>S01–S28</td><td>4:20</td></tr>
        <tr><td>60 s core (X ads)</td><td>S01 S03 S09 S11 S12 S14 S17 S26 S28</td><td>85 → 60 s via start:</td></tr>
        <tr><td>30 s "Generate anyone"</td><td>S01 S09 S10 S28</td><td>39 → 30</td></tr>
        <tr><td>Real-estate cut</td><td>S01 S22 S11 S26 S28</td><td>47 s</td></tr>
        <tr><td>Creator cut</td><td>S01 S06 S08 S13 S19 S28</td><td>55 s</td></tr>
        <tr><td>Drip singles, 1/day on the Jelly Page</td><td>any standalone segment + S28</td><td>16–18 s</td></tr>
      </table>
      <p class="small">All straight concats plus the 1.8 s cinema endcard (tolley.io/animate). <code>posted-takes.json</code> is the never-repeat ledger.</p>
    </div>
    <div>
      <h3 class="first">Execution order</h3>
      <div class="flow">
        <div class="fnum">1</div><div class="fbody"><b>$0</b> — UI captures for every route; sheet <code>jelly-a</code> + six plates (≈$3). <i>done Sep 1</i></div>
        <div class="fnum">2</div><div class="fbody"><b>$1.53</b> — S01 + S09 at 480p mini with the plate as @Image4 → judge strips → plate on/off, negative clause on/off.</div>
        <div class="fnum">3</div><div class="fbody"><b>${$(C480)}</b> — all 28 at mini; eyeball every strip in the gallery; transcript-check both lines on S09; patch prompts; note start: trims.</div>
        <div class="fnum">4</div><div class="fbody"><b>${$(C1080)}</b> — all 28 at 1080p, four in parallel, balance checked first. Retake only material failures (≤25%).</div>
        <div class="fnum">5</div><div class="fbody"><b>$0</b> — insets, assembly per cut table, 48 kHz pin, music −26 dB, labels, endcard, chapters.json, gallery + SMB, Telegram link.</div>
      </div>
      <h3>Verification</h3>
      <ul>
        <li>Every one of 28 segments has an approved mini strip before its 1080p call.</li>
        <li>ArcFace mean ≥0.80 on close shots; wardrobe head-to-toe unchanged in every wide.</li>
        <li>Whisper ≥0.85 on all 29 lines; "Tolley" never spoken; no legible generated text in any frame.</li>
        <li>ffprobe: 1080×1920 24 fps 48 kHz stereo on every final; 16:9 masters 1920×1080.</li>
        <li>Total spend ≤ the named cap; ≤1.5 generations per shipped segment.</li>
      </ul>
    </div>
  </div>
`);

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Jelly ad plan</title><style>${CSS}</style></head><body>
${p1}${p2}${p3}${p4}${p5}${p6}${p7}
</body></html>`;
writeFileSync(OUT_HTML, html);
console.log('html written:', OUT_HTML, (html.length / 1e6).toFixed(2) + ' MB');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
await p.goto('file://' + OUT_HTML, { waitUntil: 'networkidle' });
await p.emulateMedia({ media: 'print' });
for (let pass = 0; pass < 3; pass++) {
  const shrunk = await p.evaluate(() => {
    const LIMIT = 11 * 96; const out = [];
    for (const el of document.querySelectorAll('.page')) {
      const inner = el.querySelector('.pinner'); const PAD = (0.5 + 0.58) * 96;
      const cur = parseFloat(inner.style.zoom || '1'); const h = inner.getBoundingClientRect().height / cur;
      if (h * cur > LIMIT - PAD - 6) { const z = Math.max(0.7, (LIMIT - PAD - 10) / h); inner.style.zoom = String(z);
        out.push({ page: [...document.querySelectorAll('.page')].indexOf(el) + 1, zoom: +z.toFixed(3) }); }
    }
    return out;
  });
  if (!shrunk.length) break;
  if (pass === 0) console.log('auto-fit zoom applied:', JSON.stringify(shrunk));
}
const fit = await p.evaluate(() => {
  const LIMIT = 11 * 96;
  return [...document.querySelectorAll('.page')].map((el, i) => ({ page: i + 1,
    zoom: +(parseFloat(el.querySelector('.pinner').style.zoom || '1')).toFixed(3),
    over: Math.round(el.getBoundingClientRect().height - LIMIT), clipped: el.scrollHeight > el.clientHeight + 1 }));
});
console.table(fit);
const bad = fit.filter((f) => f.over > 0 || f.clipped);
console.log(bad.length ? 'OVERFLOW: ' + JSON.stringify(bad) : 'ALL PAGES FIT');
await p.pdf({ path: OUT_PDF, format: 'Letter', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
await b.close();
console.log('pdf written:', OUT_PDF);
