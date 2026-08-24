/**
 * Lady Video System V2 — visual explainer for /hq → Docs.
 *
 *   node scripts/briefs/build-lady-video-brief.mjs
 *
 * Emits a US-Letter navy/gold HTML brief with real frames from real renders
 * (base64-inlined so the PDF is self-contained), then prints a per-page fit
 * table and renders to public/research/lady-video-system-v2-2026-08.pdf.
 *
 * Pages 1–11: the four daily lanes (read off the box 2026-08-18).
 * Pages 12–16: the V2 chapter — the cinema/Seedance lane and the full
 * proof-estate-01 post-mortem (read off the box 2026-08-23).
 * V1 PDF stays published unchanged at lady-video-system-2026-08.pdf.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const IMG = '/tmp/claude-1000/-home-jelly/5f801079-2983-4f1b-9929-2dec02269d3c/scratchpad/lady-doc/img';
// V2 frames (cinema lane, proof-estate-01) — regenerate from the project mp4s if this dir is gone:
// ffmpeg -ss <t> -i cinema/projects/proof-estate-01/<file>.mp4 -frames:v 1 -vf scale=480:-1 <name>.jpg
const IMG2 = '/tmp/claude-1000/-home-jelly/18a65cf1-9afe-468b-abce-a7ab2893fb9c/scratchpad/lady-v2-img';
const CSS = readFileSync('/home/jelly/tolley-site/scripts/briefs/lady-video-system.css', 'utf8');
const OUT_HTML = '/home/jelly/tolley-site/scripts/briefs/lady-video-system-v2-2026-08.html';
const OUT_PDF = '/home/jelly/tolley-site/public/research/lady-video-system-v2-2026-08.pdf';

const img = (name, dir = IMG) => {
  const p = `${dir}/${name}`;
  if (!existsSync(p)) throw new Error('missing image: ' + p);
  const mime = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${readFileSync(p).toString('base64')}`;
};

/** one film frame + caption */
const frame = (file, stamp, cap, tall) =>
  `<div class="frame"><img src="${img(file)}"><div class="fcap${tall ? ' tall' : ''}"><b>${stamp}</b>${cap}</div></div>`;
const frame2 = (file, stamp, cap, tall) =>
  `<div class="frame"><img src="${img(file, IMG2)}"><div class="fcap${tall ? ' tall' : ''}"><b>${stamp}</b>${cap}</div></div>`;

let PAGE = 0;
const page = (body) => {
  PAGE++;
  return `<div class="page"><div class="pinner">${body}</div>
    <div class="footer"><span>The Lady Video System V2 — how a video gets made, start to finish</span><span>tolley.io/hq · Aug 23, 2026 · p${PAGE}</span></div>
  </div>`;
};

/* ─────────────────────────────────────────────────── 1. cover ───────── */
const p1 = page(`
  <div class="cover-band">
    <div class="v2tag">SYSTEM MAP · V2</div>
    <div class="kicker">HQ · Docs · Engineering brief</div>
    <h1>The Lady Video System V2</h1>
    <div class="date">Two renderers now: the four daily lanes, plus the new cinema lane that is Lady going forward · August 23, 2026</div>
  </div>

  <p class="lede">Every daily "lady video" — the Treasure&nbsp;Haul product ads, the washer/dryer
  spots, the estate-sale spots and the daily KC housing brief — is still produced by <b>one program</b>:
  <code>growth-engine/shorts/make-product-short.mjs</code>, four <b>briefs</b> handed to the same renderer.
  <b>V2 adds a second renderer:</b> the <b>cinema lane</b> (<code>growth-engine/cinema/</code>, Seedance&nbsp;2.0
  ref-to-video on fal.ai) — photoreal, handheld, she speaks on camera in her own voice. It shipped its first
  video on 8/23 (<i>"I walked an estate sale before the doors opened"</i>, 72&nbsp;s, live on FB + YouTube) and
  it is <b>the new Lady going forward</b>. Pages 1–11 map the daily system; <b>pages 12–16 are the V2 chapter</b>:
  the cinema pipeline, the exact fal payload that finally worked, and — boxed — everything that run cost,
  broke, and taught us.</p>

  <div class="box gold">
    <p><b>V2 in one line.</b> Old Lady: $1/video, keyframes + local voice clone, 30&nbsp;s, fully automatic, good enough
    to run four times a day. New Lady (cinema): ~$57 for the first 72&nbsp;s proof (retries included, next one budgeted
    ~$25–30), Seedance native voice, phone-vlog realism you cannot get from the old pipeline — reserved for flagship
    pieces, with a human eyeball between every stage.</p>
  </div>

  <div class="tiles five">
    <div class="tile goldtop"><div class="num">1</div><div class="lbl">renderer<br>(make-product-short.mjs)</div></div>
    <div class="tile"><div class="num">4</div><div class="lbl">lady lanes<br>treasures · W/D · estate · housing</div></div>
    <div class="tile greentop"><div class="num">30s</div><div class="lbl">every video<br>7 scenes × ~4.3s</div></div>
    <div class="tile purpletop"><div class="num">~$1.05</div><div class="lbl">cash per video<br>clips + script</div></div>
    <div class="tile redtop"><div class="num">8</div><div class="lbl">outside services<br>touched per render</div></div>
  </div>

  <div class="cols2">
    <div>
      <h3 class="first">What this document answers</h3>
      <ul>
        <li><b>What happens, in order</b> — the nine stages, with the real artifact each one produced on a real run.</li>
        <li><b>What the viewer sees, second by second</b> — a 30-second video pulled apart at 8 timestamps, with the system that made each frame.</li>
        <li><b>Every call that leaves the DGX</b> — host, purpose, whether it costs money, and where its key lives.</li>
        <li><b>How every link in every caption is built</b> — the affiliate tag, the shelf, the fit code, the UTM.</li>
        <li><b>Where the money goes</b> and <b>which knob changes what</b>.</li>
      </ul>
    </div>
    <div>
      <h3 class="first">The three sentences version</h3>
      <div class="box blue">
        <p><b>1. Night.</b> A systemd timer fires between 01:00 and 06:45. It picks today's subject — a product
        out of the shop database, or one of 30 rotating briefs — and hands it to the renderer.</p>
        <p><b>2. Render.</b> Kimi writes a script and a 7-scene storyboard, Gemini paints a keyframe of her in
        each scene, a local voice clone reads the script, Wan animates each keyframe into a talking clip,
        ffmpeg cuts it together with burned captions. 1–2½ hours.</p>
        <p><b>3. Morning.</b> Because it finished before 09:00, the video is <i>queued</i>, not posted. At 10:00
        <code>post-pass.timer</code> fans it out to the right pages for that lane and logs the result back to /hq.</p>
      </div>
    </div>
  </div>

  <h3>The one thing to understand before anything else</h3>
  <div class="box gold">
    <p><b>Briefs vs. products.</b> The renderer has two front doors. <code>--auto</code> means "go find a
    product in the Neon shop database and sell it" — that is the Treasure Haul lane, and it is the only lane
    that carries Amazon affiliate links. <code>--brief file.json</code> means "here is a business, a pitch,
    an offer and a link — sell that" — that is W/D, estate and housing, and those captions carry
    <i>your own</i> tolley.io links, no <code>#ad</code>, no affiliate tag. Same face, same voice, same
    30 seconds, completely different money model. Everything downstream of the script branches on
    that one flag.</p>
  </div>
`);

/* ─────────────────────────────────────────────── 2. the map ───────── */
const stage = (n, label, title, desc, meta) => `
  <div class="frow"><div class="fnum">${n}<small>${label}</small></div>
    <div class="fbody"><div class="ft">${title}</div><div class="fd">${desc}</div><div class="fmeta">${meta}</div></div></div>
  <div class="farrow">▼</div>`;

const p2 = page(`
  <h2><span class="n">01</span>The whole machine, top to bottom</h2>
  <div class="sub">Nine stages. <span class="tag loc">LOCAL</span>/<span class="tag free">FREE</span> stays on the DGX · <span class="tag net">NET</span> leaves the building · <span class="tag paid">PAID</span> costs cash.</div>

  <div class="flow tight">
    ${stage('0', 'CLOCK', 'A systemd timer fires', 'estate 01:00 · treasures 02:30 (×2) · W/D Mon 05:00 · housing 06:45. Each lane holds a <code>flock</code> so a slow render can never be started twice.', '<span class="tag loc">LOCAL</span> ~/.config/systemd/user/*.timer')}
    ${stage('1', 'SUBJECT', 'Pick today\'s subject', '<b>Treasures:</b> queries Neon over psql for ASIN-tagged products — haul-eligible first, ranked by a women+decor keyword score, holiday items skipped Jun–Sep, gate-failed ASINs benched 14 days. <b>Brief lanes:</b> <code>briefs/*.json</code> picked by day-of-year mod 30, so a same-day re-run picks the same brief.', '<span class="tag net">NET</span> Neon Postgres · <span class="tag loc">LOCAL</span> briefs/*.json')}
    ${stage('2', 'IMAGERY', 'Source the product photos + vision gate', 'Scrapes the official Amazon gallery through a warm CDP Chrome on :9223, falling back to the seller photos in the DB. Gemini classifies every image — screenshots, packaging-only shots, junk and near-dupes are dropped. Too few clean hero shots and the product is <b>skipped entirely</b>; the next candidate is tried, up to 8.', '<span class="tag net">NET</span> amazon.com · Gemini 2.5 Flash · <span class="tag loc">LOCAL</span> Chrome :9223')}
    ${stage('3', 'SCRIPT', 'Write the script and the storyboard', 'Kimi K3 — a vision model, it <i>sees</i> the hero photos — writes the 30-second script plus exactly 7 scene objects: room, her physical action, energy, gaze, and the verbatim line she speaks under it. A short scene list or a visual that contradicts the narration is sent back to be fixed, twice. Local Qwen3.6 on :8356 is the free fallback.', '<span class="tag net">NET</span><span class="tag paid">$0.20</span> Kimi K3 on Modal · <span class="tag free">FREE</span> vLLM :8356')}
    ${stage('4', 'KEYFRAME', 'Paint her into each scene', 'Gemini 3.1 Flash Image ("Nano Banana 2") renders one 9:16 keyframe per scene: her canonical face from <code>character-ref.png</code>, today\'s outfit from the wardrobe rotation, the real product photos as reference, and the shot/lens/angle from the camera library.', '<span class="tag net">NET</span><span class="tag paid">~$0.01/frame</span> generativelanguage.googleapis.com')}
    ${stage('5', 'VOICE', 'Read the script', 'IndexTTS-2 on the local ComfyUI clones the "Jessica" reference and reads the script; <code>fitVoiceToTarget</code> then stretches or compresses it (pitch-preserving) toward 30s. Shot length, caption timing and sync slots all key off audio length, so this must happen before anything measures it. ElevenLabs is wired but OFF since Aug 4.', '<span class="tag free">FREE</span> ComfyUI :8188 · IndexTTS-2')}
    ${stage('6', 'MOTION', 'Turn each still into a moving, talking clip', 'The one stage that really costs. Face-visible scenes go to <b>Wan2.2-S2V</b> on Modal — a one-pass talking clip driven by that scene\'s slice of the voiceover, so the mouth is synced at generation time. Non-face shots use i2v, which prefers the DGX\'s own GPU on :8190 for $0. Any clip that cannot be made degrades to a Ken Burns pan.', '<span class="tag net">NET</span><span class="tag paid">$0.12/clip</span> Modal "lady-wan22" L40S · <span class="tag free">FREE</span> local Wan :8190')}
    ${stage('7', 'CUT', 'Assemble', 'ffmpeg normalises every clip to one profile and cuts them together — hard cuts between two face shots, because a dissolve there superimposes two of her and reads as a ghost. Captions are burned chunk by chunk weighted by character count, plus a persistent <code>#ad</code> tag; voice mixed to −16 LUFS; 1080×1920 H.264 out. Real-estate lanes also get the brokerage license band.', '<span class="tag free">FREE</span> ffmpeg on the DGX')}
    ${stage('8', 'CHECK', 'QA, then queue or post', 'Gemini looks at 4 frames of the finished file and votes on 7 failure modes (repeated stills, screenshots, packaging-only, frozen mouth, price text, broken frames). Finished before 09:00 → appended to <code>post-queue.jsonl</code>; <code>post-pass.timer</code> at 10:00 fans it out per lane and logs every leg back to /hq.', '<span class="tag net">NET</span> Gemini · YouTube · Meta Graph · Pinterest/TikTok drivers · tolley.io')}
  </div>

  <div class="box red" style="margin-top:2pt">
    <p><b>Read the arrows as "degrades to", not "stops".</b> No Kimi → Qwen writes it. No keyframe → a
    product hero fills the slot. No Wan clip → Ken Burns. QA fail → it still renders, it just refuses to
    auto-post. That is why the lane almost never goes dark — and why a quietly degraded video can ship
    looking fine in the log.</p>
  </div>
`);

/* ──────────────────────────────────── 3. anatomy w/ timestamps ───── */
const p3 = page(`
  <h2><span class="n">02</span>One video, second by second</h2>
  <div class="sub"><b>Real file:</b> <code>shorts/review/2026-08-18-pull-out-cabinet-organizer-pan-sweep.mp4</code>
  — rendered 03:52 this morning, 30.00s, 1080×1920, 30fps, template <code>pan-sweep</code>,
  voice Jessica (IndexTTS-2), 7 scenes, QA clean, $0.84 of Modal clips.</div>

  <div class="ruler">
    <div class="seg" style="left:0%;width:14.3%"><b>0:00–0:04</b>HOOK · scene 1</div>
    <div class="seg" style="left:14.3%;width:14.3%"><b>0:04–0:08</b>scene 2</div>
    <div class="seg" style="left:28.6%;width:14.3%"><b>0:08–0:12</b>scene 3</div>
    <div class="seg" style="left:42.9%;width:14.3%"><b>0:12–0:17</b>scene 4</div>
    <div class="seg" style="left:57.2%;width:14.3%"><b>0:17–0:21</b>scene 5</div>
    <div class="seg" style="left:71.5%;width:14.3%"><b>0:21–0:25</b>scene 6</div>
    <div class="seg" style="left:85.8%;width:14.2%;border-right:none"><b>0:25–0:30</b>CLOSE · scene 7</div>
  </div>

  <div class="strip s8">
    ${frame('shorts-0.5.jpg', '0:00.5', 'Scene 1 = the hook. She is already mid-motion — the storyboard forbids a scene that starts from rest.', true)}
    ${frame('shorts-4.5.jpg', '0:04.5', 'Scene 2. Hard cut, not a dissolve: two adjacent face shots would ghost across each other.', true)}
    ${frame('shorts-9.0.jpg', '0:09.0', 'Scene 3. Same kitchen — the writer is told to change rooms at most twice in a whole video.', true)}
    ${frame('shorts-13.5.jpg', '0:13.5', 'Scene 4. Her hands are on the product; the line she speaks here names what she is doing.', true)}
    ${frame('shorts-18.0.jpg', '0:18.0', 'Scene 5. The honest-caveat beat. Wan2.2-S2V drives her mouth from this slice of the voiceover.', true)}
    ${frame('shorts-22.5.jpg', '0:22.5', 'Scene 6. Captions are re-timed per chunk by character count, not fixed intervals.', true)}
    ${frame('shorts-27.0.jpg', '0:27.0', 'Scene 7 = the close. Every video starts and ends on her — no product-still bookends.', true)}
    ${frame('shorts-29.5.jpg', '0:29.5', 'The fit CTA tail: "Like the fit? The link for that is below too."', true)}
  </div>

  <div class="cols2" style="margin-top:6pt">
    <div>
      <h3 class="first">What is actually on the screen</h3>
      <table class="tight">
        <tr><th>Layer</th><th>Made by</th><th>When</th></tr>
        <tr><td><b>Her face &amp; body</b></td><td>Gemini 3.1 Flash Image, seeded from <code>character-ref.png</code></td><td>stage 4</td></tr>
        <tr><td><b>Her outfit</b></td><td>Wardrobe rotation — look #599 of <code>persona-wardrobe.json</code>, 1-in-4 chance of a glam look</td><td>stage 4</td></tr>
        <tr><td><b>The product</b></td><td>The real seller/Amazon photos, passed to Gemini as reference images</td><td>stage 2→4</td></tr>
        <tr><td><b>The room</b></td><td>Written by Kimi — told to put the product where it actually lives (a kitchen gadget on a counter, not a default living room)</td><td>stage 3</td></tr>
        <tr><td><b>The movement</b></td><td>Wan2.2-S2V on a Modal L40S, one clip per scene, ~69 frames at 16fps</td><td>stage 6</td></tr>
        <tr><td><b>The mouth</b></td><td>S2V again — the voiceover slice <i>is</i> the driver, so no separate lip-sync pass runs</td><td>stage 6</td></tr>
        <tr><td><b>The voice</b></td><td>IndexTTS-2 cloning the Jessica reference, locally, $0</td><td>stage 5</td></tr>
        <tr><td><b>The yellow captions</b></td><td>ffmpeg <code>drawtext</code>, one text file per chunk, timed by character weight</td><td>stage 7</td></tr>
        <tr><td><b>The <code>#ad</code> corner</b></td><td>ffmpeg, burned for the whole duration (FTC + Amazon Associates)</td><td>stage 7</td></tr>
      </table>
    </div>
    <div>
      <h3 class="first">Why 7 scenes and not 5 or 12</h3>
      <div class="box blue">
        <p>It is <b>derived, not chosen</b>. Wan caps a clip at 81 frames at 16fps ≈ <b>5.06 seconds</b>.
        If a scene slot is longer than one Wan clip, the tail gets clone-held and you see a visible freeze
        at the end of every scene. So the renderer computes
        <code>ceil(31 ÷ 5.06) = 7</code> scenes from the 30-second target and refuses to let you pin it.</p>
        <p><b>Change the length, and the scene count moves with it</b> — 45s → 10 scenes, 88s → 18. That is
        also why cutting 45s→30s on Aug 8 cut roughly a third of the cash cost: fewer paid clips, fewer
        paid keyframes.</p>
      </div>
      <h3>The spoken script, verbatim</h3>
      <div class="box">
        <p style="font-size:8.4pt;font-style:italic;color:#33405c">"I expected a headache. I got joy. I thought
        assembly would be a nightmare. No drilling needed. That alone won me over. I slid it into my cabinet.
        Adjustable width fits perfectly. One drawer glides out smooth. No more digging for buried items.
        It does take up some depth. <b>But the access is worth it.</b> Total game changer for my kitchen.
        Like the fit? The link for that is below too."</p>
        <p class="small">76 words. The arc is enforced by the prompt: hook → the doubt → unboxing → a real
        usage moment → the honest caveat → the verdict. The caveat is deliberate — it is what makes the
        rest read as a real person.</p>
      </div>
    </div>
  </div>
`);

/* ─────────────────────────── 4. artifact chain screenshots ───────── */
const p4 = page(`
  <h2><span class="n">03</span>The same four seconds, at every stage</h2>
  <div class="sub">Pulled out of a real working directory left on disk from the Aug 10 run of the
  $100 folding-table product (<code>/tmp/short-EdIyZh</code>). This is literally what the pipeline
  hands to the next stage.</div>

  <div class="strip s4">
    ${frame('stage-seller.jpg', 'STAGE 2 · INPUT', 'The seller photo out of the shop database. Real product, real listing image — nothing generated yet.', true)}
    ${frame('stage-key0.jpg', 'STAGE 4 · KEYFRAME', 'Gemini renders her into scene 1 holding that product, with her canonical face and today\'s outfit. A still.', true)}
    ${frame('stage-clip-a.jpg', 'STAGE 6 · CLIP, f.1', 'Wan takes the keyframe as frame 1 and generates ~69 frames of motion from the scene\'s "motion" prompt.', true)}
    ${frame('stage-clip-b.jpg', 'STAGE 6 · CLIP, last', 'The last frame of the same clip. She has moved, the room held, the product survived — that is the whole test.', true)}
  </div>

  <div class="cols2" style="margin-top:8pt">
    <div>
      <h3 class="first">What the vision gate throws away</h3>
      <p>Before any of the above, every candidate image is sent to Gemini and labelled. The classes that
      get dropped: <b>screenshots</b> (a phone screenshot of a listing — the July 11 incident this gate was
      built for), <b>packaging-only</b> shots of a closed box, <b>junk</b>, and <b>near-duplicates</b> of an
      image already kept.</p>
      <p>A product that cannot survive the gate is <b>benched for 14 days</b> in
      <code>gate-failed.json</code> and the renderer moves on. Before that bench existed the picker retried
      the same 8 losers nightly while 70+ untried products waited, and the lane rendered 0 of 2 twice.</p>

      <h3>The two image sources, in order</h3>
      <ul>
        <li><b>Official Amazon gallery</b> for the ASIN, scraped through a persistent Chrome you keep warm
        on <code>:9223</code>. The gate is run in <code>--no-aspect</code> mode here — gallery images are
        never phone screenshots, and the aspect rule was killing valid tall hero shots.</li>
        <li><b>Seller photos</b> from the <code>Product.imageUrls</code> column in Neon, downloaded and
        ffprobe-validated for decodability before use.</li>
      </ul>
    </div>
    <div>
      <h3 class="first">The face is a file, not a prompt</h3>
      <div class="strip s3">
        ${frame('stage-face.jpg', 'character-ref.png', 'The canonical portrait. Locked Aug 10.', false)}
        ${frame('stage-key1.jpg', 'scene 2 keyframe', 'Same face, new room, new angle.', false)}
        ${frame('stage-amz.jpg', 'amz0.jpg', 'Official gallery shot, post-gate.', false)}
      </div>
      <div class="box gold">
        <p><b>This is the consistency mechanism.</b> Gemini is handed <code>character-ref.png</code> on every
        single scene of every single video across all four lanes, and told: take the face, hair and skin
        from this photo, take the <i>clothes</i> from the text prompt. That split is what lets the wardrobe
        rotate daily while she stays recognisably the same person.</p>
        <p>Change that one PNG and every lane changes at once. There is no per-lane face.</p>
      </div>
      <p class="small">The camera is separate again: framing + lens + angle are chosen per scene from
      <code>persona-cinema.json</code> and go into the <i>keyframe</i>; the camera <i>move</i> goes into the
      Wan prompt. Kimi is explicitly forbidden from writing camera direction, because its copy fights the
      choreographed move.</p>
    </div>
  </div>
`);

/* ───────────────────────────────────── 5. the four lanes ────────── */
const p5 = page(`
  <h2><span class="n">04</span>The four lanes</h2>
  <div class="sub">Same renderer, same face, same voice. What differs: the clock, the subject source,
  the link in the caption, and where it gets posted.</div>

  <table>
    <tr><th style="width:15%">Lane</th><th style="width:13%">Fires</th><th style="width:20%">Subject comes from</th><th style="width:22%">Link in the caption</th><th>Posts to</th></tr>
    <tr>
      <td><b>💎 Treasures</b><br><span class="small">"product shorts"</span></td>
      <td><b>02:30</b> daily<br><span class="small">×2 videos</span></td>
      <td>Neon <code>Product</code> table, ASIN-tagged, haul-eligible first</td>
      <td>Amazon affiliate <code>/dp/&lt;ASIN&gt;</code> + storefront shelf + <code>tolley.io/shop</code> + fit link</td>
      <td>YouTube (@ruthann) · FB Treasure Haul · IG · Pinterest (:9108) · TikTok (:9106) · Bluesky · Threads · X</td>
    </tr>
    <tr>
      <td><b>🏛️ Estate</b></td>
      <td><b>01:00</b> daily</td>
      <td><code>estate/briefs/*.json</code> — 30 briefs, day-of-year rotation</td>
      <td><code>tolley.io/estate</code> + fit link. No affiliate, no <code>#ad</code>.</td>
      <td>Facebook Reel → Tolley Estate Sales page <code>1192241847311343</code></td>
    </tr>
    <tr>
      <td><b>🧺 Washer/Dryer</b></td>
      <td><b>Mon 05:00</b><br><span class="small">weekly</span></td>
      <td><code>wd-content/briefs/*.json</code> — 30 briefs, day-of-year rotation</td>
      <td><code>tolley.io/wd</code> + fit link</td>
      <td>YouTube (@ruthann) + FB Wash&nbsp;&amp;&nbsp;Dry Rental KC <code>1060351927154451</code></td>
    </tr>
    <tr>
      <td><b>🏡 Housing</b><br><span class="small">"KC Housing Daily"</span></td>
      <td><b>06:45</b> daily</td>
      <td>Built fresh each morning from the market-pulse brief — not a static file</td>
      <td><code>tolley.io/housing</code> + fit link</td>
      <td>YouTube (@yourkchomes) · FB Your KC Homes <code>230414410149647</code> · LinkedIn · Pinterest</td>
    </tr>
  </table>

  <div class="cols3" style="margin-top:9pt">
    <div>
      <div class="strip s3">
        ${frame('estate-1.jpg', 'ESTATE 0:08', '', false)}
        ${frame('estate-2.jpg', '0:15', '', false)}
        ${frame('estate-3.jpg', '0:22', '', false)}
      </div>
      <div class="box" style="margin-top:2pt">
        <div class="bt">🏛️ Aug 18, 02:30</div>
        <p style="font-style:italic">"We turn down sales. On purpose."</p>
        <p class="small">Brief <code>boutique-not-franchise</code>. 87 min render, $0.99, QA clean.
        Posted as a Reel to the estate page at 10:00.</p>
      </div>
    </div>
    <div>
      <div class="strip s3">
        ${frame('wd-1.jpg', 'W/D 0:08', '', false)}
        ${frame('wd-2.jpg', '0:15', '', false)}
        ${frame('wd-3.jpg', '0:22', '', false)}
      </div>
      <div class="box" style="margin-top:2pt">
        <div class="bt">🧺 Aug 17, 05:00</div>
        <p style="font-style:italic">"I wrote your laundromat resignation letter."</p>
        <p class="small">Brief <code>wd-quit-the-laundromat</code>. 63 min render, $0.99, QA clean.
        YouTube + the KC page.</p>
      </div>
    </div>
    <div>
      <div class="strip s3">
        ${frame('housing-1.jpg', 'HOUSING 0:08', '', false)}
        ${frame('housing-2.jpg', '0:15', '', false)}
        ${frame('housing-3.jpg', '0:22', '', false)}
      </div>
      <div class="box" style="margin-top:2pt">
        <div class="bt">🏡 Aug 17, 06:45</div>
        <p style="font-style:italic">"SpaceX alum builds Lego homes."</p>
        <p class="small">57 min render, $0.84. <b>QA failed</b> — it published anyway, by design.
        Note the license band burned across the top.</p>
      </div>
    </div>
  </div>

  <div class="box red" style="margin-top:6pt">
    <p><b>Drift worth fixing:</b> <code>wd-weekly-video.sh</code>'s own header says "one persona video a DAY …
    cadence went weekly→daily 8/1", but <code>wd-weekly-video.timer</code> still reads
    <code>OnCalendar=Mon *-*-* 05:00:00</code>. <b>The timer wins.</b> W/D has been shipping one video a
    week, not seven, since that change was written. If daily was the intent, the timer is the one-line fix;
    if weekly was, the script header is lying to whoever reads it next.</p>
  </div>

  <div class="cols2" style="margin-top:8pt">
    <div>
      <h3 class="first">Identical across all four lanes</h3>
      <ul>
        <li>The renderer — one file, <code>make-product-short.mjs</code></li>
        <li>Her face — one PNG, <code>character-ref.png</code></li>
        <li>Her voice — Jessica, cloned locally by IndexTTS-2</li>
        <li>Length, scene count, wardrobe rotation and camera library — all from <code>CREATIVE-SETTINGS.env</code></li>
        <li>The <code>#ad</code> burn, the burned captions, the QA pass</li>
        <li>The Telegram ping, and the <code>tolley.io/fit</code> link</li>
      </ul>
    </div>
    <div>
      <h3 class="first">Different per lane</h3>
      <ul>
        <li>The <b>clock</b> — one timer each, deliberately staggered so only one heavy render runs at a time</li>
        <li>The <b>subject</b> — a database row, a rotating brief file, or a freshly built market brief</li>
        <li>The <b>link</b>, and whether it carries an affiliate tag at all</li>
        <li>The <b>fanout</b> — which channels, which accounts, which page ID</li>
        <li>The <b>AUTOPOST flag</b> (housing has none — it posts in-run)</li>
        <li>Real-estate lanes only: the burned brokerage license band</li>
      </ul>
    </div>
  </div>
`);

/* ─────────────────────── 6. the fifth lane / listings sibling ───── */
const p6 = page(`
  <h2><span class="n">05</span>The lane that is <i>not</i> her — and why it matters</h2>
  <div class="sub">"New KC Homes Today" is the other real-estate video job, and people confuse the two
  constantly because they land on the same YouTube channel.</div>

  <div class="cols2">
    <div>
      <h3 class="first">What listings-video actually is</h3>
      <p>A completely separate program — <code>housing-hub/run_listings.py</code> — that fires
      <b>Mon 10:30</b>, walks 33 KC-metro cities, collects each city's new Redfin listings through one
      warm browser session, verifies them in a single batched Matrix MLS pass, and builds a
      <b>photo slideshow</b> per city with a <b>Jared voice clone</b> narrating. No persona, no Gemini,
      no Wan, no Modal. Cost is essentially zero.</p>
      <p>Cities with fewer than 2 usable listings are cleanly skipped. On the Aug 17 run that meant
      <b>6 of 33 cities shipped</b> — Prairie Village, Raymore, Raytown, Lone Jack, Platte City,
      Harrisonville — and 27 were skipped for thin inventory. One Facebook roundup post covers the day.</p>
      <p>A separate <b>drain</b> timer at Tue 07:00 retries anything YouTube deferred for quota. That exists
      because a 33-city day can exhaust the daily upload quota mid-run.</p>

      <h3>Why it is worth knowing the difference</h3>
      <ul>
        <li>If housing videos look wrong, <b>which one</b> matters: the lady brief (06:45, Gemini/Wan/Modal)
        and the listings slideshow (Mon 10:30, photos + Jared's voice) share nothing but a channel.</li>
        <li>Listings is <b>deliberately excluded</b> from <code>CREATIVE-SETTINGS.env</code> — its length is
        driven by listing count, not the 30-second ad target. Changing the ad length does not touch it.</li>
        <li>It is the only lane whose photos come from third-party portals, which is why the compliance
        choice (public portals only) is recorded in its header.</li>
      </ul>
    </div>
    <div>
      <div class="strip s3">
        ${frame('listings-1.jpg', 'HOUSING BRIEF', 'The 06:45 lady lane. License band top-left, her on camera, 30s.', true)}
        ${frame('housing-0.jpg', '0:01', 'Same lane, opening frame.', true)}
        ${frame('housing-4.jpg', '0:28', 'Same lane, close.', true)}
      </div>
      <div class="box gold">
        <p><b>The license band is not decoration.</b> Missouri 20 CSR 2250-8.070 requires the broker's
        licensed name on every advertisement by a licensee. It is burned <b>top-left</b>, not bottom,
        because YouTube's own title/CTA chrome covers the bottom ~15% of a Short — a disclosure down
        there is not "clearly and conspicuously displayed".</p>
        <p>It is drawn with PIL, never ffmpeg <code>drawtext</code>, because drawtext silently drops one
        trailing character per multi-byte glyph and was truncating the license number
        (<code>KS 00251854</code> → <code>KS 002518</code>).</p>
      </div>
      <div class="box red">
        <p><b>If the watermark step fails, housing refuses to publish.</b> That is the one hard stop in the
        entire system — publishing nothing beats publishing an unlicensed real-estate ad.</p>
      </div>
    </div>
  </div>

  <h3>The daily clock, all lanes together</h3>
  <table class="tight">
    <tr><th>Time (CT)</th><th>Unit</th><th>What runs</th><th>Ends up</th></tr>
    <tr><td><b>01:00</b> daily</td><td><code>estate-video.timer</code></td><td>1 estate video, ~87 min</td><td>queued (finished &lt; 09:00)</td></tr>
    <tr><td><b>02:30</b> daily</td><td><code>growth-shorts.timer</code></td><td>2 product videos, ~60–110 min each</td><td>queued</td></tr>
    <tr><td><b>05:00</b> Mon</td><td><code>wd-weekly-video.timer</code></td><td>1 W/D video, ~63 min</td><td>queued</td></tr>
    <tr><td><b>06:45</b> daily</td><td><code>housing-hub.timer</code></td><td>market pulse → 1 housing video → posts immediately</td><td>posted in-run</td></tr>
    <tr><td><b>07:00</b> Tue</td><td><code>listings-drain.timer</code></td><td>retry yesterday's quota-deferred YouTube uploads</td><td>posted</td></tr>
    <tr><td><b>10:00</b> daily</td><td><code>post-pass.timer</code></td><td>claims <code>post-queue.jsonl</code> atomically, fans every queued video out per lane</td><td>posted + logged to /hq</td></tr>
    <tr><td><b>10:30</b> Mon</td><td><code>listings-video.timer</code></td><td>33 cities → per-city slideshows → YouTube + 1 FB roundup</td><td>posted</td></tr>
  </table>
  <p class="small">Renders were moved to the night on Aug 9 after daytime OOM lockups killed two videos
  mid-flight — the DGX's 128GB unified memory cannot host a Wan render and vLLM and the workers at the
  same time. Posting was decoupled at the same time so the overnight finish does not dump a video into a
  dead audience window at 4am.</p>
`);

/* ─────────────────────── 7. every call to the internet ─────────── */
const p7 = page(`
  <h2><span class="n">06</span>Every call that leaves the building</h2>
  <div class="sub">Per video render. Eight outside services, plus the posting fanout. This is the complete
  list — if it is not here, it does not leave the DGX.</div>

  <h3 class="first">During the render</h3>
  <table class="tight">
    <tr><th style="width:19%">Host</th><th style="width:15%">What for</th><th style="width:8%">Stage</th><th style="width:11%">Cost</th><th style="width:19%">Credential</th><th>Notes</th></tr>
    <tr><td><b>Neon Postgres</b><br><span class="small">via <code>psql</code></span></td><td>Read the shop catalog — title, ASIN, images, price, haul flag</td><td>1</td><td><span class="tag free">FREE</span></td><td><code>DATABASE_URL</code> in <code>tolley-site/.env.local</code></td><td>Treasures lane only.</td></tr>
    <tr><td><b>amazon.com</b><br><span class="small">via CDP Chrome :9223</span></td><td>Official product gallery for the ASIN</td><td>2</td><td><span class="tag free">FREE</span></td><td>Warm browser profile <code>~/.research-chrome-profile</code></td><td>Cron relaunches it via <code>systemd-run</code> if down; if it still fails, the gate starves and renders skip.</td></tr>
    <tr><td><b>generativelanguage<br>.googleapis.com</b></td><td>Vision gate — classify/reject every candidate image</td><td>2</td><td><span class="tag paid">~$0.01</span></td><td><code>~/.config/autopilot.env</code></td><td>Chain: 2.5-flash → 2.0-flash → flash-latest. All fail = heuristic pass.</td></tr>
    <tr><td><b>Modal</b> — Kimi K3<br><span class="small">managed endpoint</span></td><td>Write the script + 7-scene storyboard (a vision model — it sees the photos)</td><td>3</td><td><span class="tag paid">$0.20</span></td><td><code>MODAL_PROXY_KEY</code>/<code>SECRET</code></td><td>Falls back to Qwen3.6 on :8356 (free, text-only). Cron probes it with a 1-token call first.</td></tr>
    <tr><td><b>generativelanguage<br>.googleapis.com</b></td><td>Paint her into each scene — Gemini 3.1 Flash Image ("Nano Banana 2")</td><td>4</td><td><span class="tag paid">~$0.07</span></td><td><code>~/.config/autopilot.env</code></td><td>7 frames. Retries without refs on a safety refusal.</td></tr>
    <tr><td><b>Modal</b> — <code>lady-wan22</code><br><span class="small">L40S GPUs</span></td><td>Wan2.2-S2V talking clips, one per face scene</td><td>6</td><td><span class="tag paid">$0.12<br>/clip</span></td><td><code>~/.modal.toml</code></td><td><b>The main spend.</b> One container per clip (<code>AI_CLIP_FANOUT=1</code>) — 7 in parallel, ~8 min not ~48.</td></tr>
    <tr><td><b>generativelanguage<br>.googleapis.com</b></td><td>QA — look at 4 frames of the finished file, vote on 7 failure modes</td><td>8</td><td><span class="tag paid">~$0.01</span></td><td><code>~/.config/autopilot.env</code></td><td>Informational. Gates auto-posting, never the render.</td></tr>
    <tr><td><b>api.telegram.org</b></td><td>Tell you what happened</td><td>all</td><td><span class="tag free">FREE</span></td><td><code>~/xero-ledger/.env</code></td><td>Same bot/chat for every lane.</td></tr>
  </table>

  <h3>Wired but currently OFF</h3>
  <table class="tight">
    <tr><th style="width:22%">Host</th><th style="width:20%">Was for</th><th style="width:14%">Switched off</th><th>Why, and what replaced it</th></tr>
    <tr><td><b>api.elevenlabs.io</b></td><td>Hosted voiceover</td><td>Aug 4</td><td>Account past-due with the character quota spent — every render paid a failed round-trip before falling back anyway. Replaced by local IndexTTS-2; re-enable with <code>SHORTS_USE_ELEVENLABS=1</code>.</td></tr>
    <tr><td><b>queue.fal.run</b><br><span class="small">Kling lip-sync</span></td><td>Mouth sync per clip</td><td>Aug 7</td><td>Your A/B call: it re-rendered every face scene at its own quality, ate ~40% of the upscale gains and inflated her mouth 24–32%, with no knobs. Superseded by S2V syncing at generation time.</td></tr>
  </table>

  <h3>At post time (10:00, or in-run for housing)</h3>
  <table class="tight">
    <tr><th style="width:22%">Destination</th><th style="width:26%">How</th><th>Which lanes</th></tr>
    <tr><td><b>YouTube Data API</b></td><td><code>content-autopilot/publishers/youtube_publisher.py</code>, OAuth refresh token per channel</td><td>Treasures + W/D → @ruthann · Housing + Listings → @yourkchomes</td></tr>
    <tr><td><b>graph.facebook.com</b></td><td>Page video / Reel, page access token per page</td><td>All four, each to its own page</td></tr>
    <tr><td><b>graph.facebook.com</b> (IG)</td><td>Reels container + publish</td><td>Treasures</td></tr>
    <tr><td><b>Pinterest</b></td><td>Local Selenium driver — <code>:9107</code> Your KC Homes, <code>:9108</code> Ruthann's Treasure Haul</td><td>Treasures, Housing</td></tr>
    <tr><td><b>TikTok</b></td><td>Local Selenium driver on <code>:9106</code> — takes a local file path, stages to the NAS outbox itself</td><td>Treasures</td></tr>
    <tr><td><b>graph.threads.net</b> · <b>api.x.com</b> · Bluesky</td><td>Direct API</td><td>Treasures</td></tr>
    <tr><td><b>www.tolley.io/api/hq/post-log</b></td><td><code>POST</code> with <code>x-sync-secret</code> — every leg's status, URL and error</td><td>All. This is what fills the /hq Posts tab.</td></tr>
  </table>
`);

/* ────────────────────────────── 8. link generation ─────────────── */
const p8 = page(`
  <h2><span class="n">07</span>How every link is built</h2>
  <div class="sub">Nothing in a caption is typed by hand. Every URL is assembled at metadata time from the
  product row, the platform, and today's wardrobe pick.</div>

  <h3 class="first">1 · The affiliate link — Treasures only</h3>
  <div class="box">
    <p class="url">https://www.amazon.com/dp/<span class="hl2">B0DJ73NCSJ</span>?tag=<span class="hl">tolley-yt-20</span></p>
    <p><span class="hl2">&nbsp;&nbsp;</span> the ASIN, straight off the <code>Product.amazonAsin</code> column &nbsp;·&nbsp;
    <span class="hl">&nbsp;&nbsp;</span> a <b>per-platform subtag</b>, so /hq can tell you which platform earned the click.</p>
    <p class="small">Master tag <code>tolley-shop-20</code>. Subtags: yt / pin / fb / ig / tt / x, each
    <code>tolley-&lt;plat&gt;-20</code>. These must be <b>registered in Associates Central</b> before that
    platform's leg goes live, or the commission silently drops on the floor.</p>
  </div>

  <h3>2 · The storefront shelf link</h3>
  <div class="box">
    <p class="url">https://www.amazon.com/shop/digitaljared/list/<span class="hl2">2XYPG23E8JCC</span>?tag=<span class="hl">tolley-yt-20</span></p>
    <p>The ASIN is looked up against the committed shelf sheet to find which of the 10 Idea Lists it lives on
    — "Kitchen &amp; Coffee" here — and the caption links <b>that shelf</b> instead of the bare storefront.
    A product not on any shelf falls back to <code>amazon.com/shop/digitaljared</code>.</p>
  </div>

  <h3>3 · The shoppable-fit link — every lane</h3>
  <div class="box">
    <p class="url">https://tolley.io/fit/<span class="hl3">knit-tank-midi-skirt~ivory~white-tennis-shoes~pendant-stacked-rings~pearl-hair-clips</span>?utm_source=<span class="hl">yt</span>&amp;utm_medium=social&amp;utm_campaign=fit</p>
    <p>The code is <b>her actual outfit for this video</b>, tilde-joined from the wardrobe pick:
    silhouette ~ colour ~ footwear ~ jewelry ~ hair. It is not stored anywhere — the page resolves the code
    against <code>persona-fit-catalog.json</code> at request time, which is why old videos keep working.</p>
  </div>

  <p class="small">She also <i>says</i> it out loud in the last line of the script —
  <code>PERSONA_FIT_CTA=1</code> appends the spoken tail. The page itself is on the next spread.</p>

  <div class="cols2" style="margin-top:4pt">
    <div>
      <h3 class="first">4 · The brief-lane link</h3>
      <p class="url">https://tolley.io/<span class="hl3">estate</span>?utm_source=<span class="hl">fb</span>&amp;utm_medium=social&amp;utm_campaign=<span class="hl2">estate-video</span></p>
      <p class="small">Base URL and campaign both come out of the brief JSON, so adding a new brief lane is
      a file, not a code change. No affiliate tag, no <code>#ad</code> — it is your own service.</p>
      <h3>5 · The own-shop link</h3>
      <p class="url">https://tolley.io/shop/<span class="hl2">cmprso4i6000mjv04ws64sgg2</span>?utm_source=<span class="hl">bluesky</span>&amp;utm_medium=social&amp;utm_campaign=shorts</p>
      <p class="small">Used on Bluesky and Threads. Amazon Associates only permits affiliate links on
      FB / IG / X / YouTube / TikTok / Twitch — so those two legs point at your own page, which carries the
      affiliate link and the disclosure. Compliant, and the UTM still shows in /hq referrer stats.</p>
    </div>
    <div>
      <h3 class="first">Why there are two link styles at all</h3>
      <div class="box blue">
        <p><b>Amazon Associates only permits affiliate links on FB, IG, X, YouTube, TikTok and Twitch.</b>
        Bluesky and Threads are not on that list — so those legs link to <code>tolley.io/shop</code>, which
        carries the affiliate link and the disclosure itself. Fully compliant, and the UTM still shows up in
        /hq referrer stats.</p>
        <p>Instagram is a third case: it permits the link but the platform gives you nowhere clickable to
        put it, so the caption says "link in bio" and the affiliate URL rides in the metadata as
        <code>referenceLink</code> for the manual bio/Creator-Center pass.</p>
      </div>
      <h3>What is <i>not</i> automated</h3>
      <ul>
        <li><b>TikTok product anchors.</b> The clickable path is a Creator Center "Link Products" pass — the caption can only point at the bio.</li>
        <li><b>The IG bio link</b> itself.</li>
        <li><b>Registering a new subtag</b> in Associates Central before that platform\'s leg goes live. An unregistered subtag silently earns nothing.</li>
      </ul>
    </div>
  </div>
`);

/* ───────────────────── 8b. where those links land ─────────────── */
const p8b = page(`
  <h2><span class="n">07b</span>Where those links land</h2>
  <div class="sub">Both live right now. Left: the exact fit code generated by the Aug 18 product video. Right: the shop page the non-Amazon platforms point at.</div>

  <div class="cols2">
    <div class="shot half">
      <img src="${img('site-fit.png')}">
      <div class="scap"><b>tolley.io/fit/knit-tank-midi-skirt~ivory~…</b> — every piece resolves to a real
      Amazon product with the affiliate tag attached, plus the disclosure block. The code is resolved at
      request time, so old videos keep working forever.</div>
    </div>
    <div class="shot half">
      <img src="${img('site-shop.png')}">
      <div class="scap"><b>tolley.io/shop</b> — where the Bluesky, Threads and "link in bio" legs land.
      It carries the affiliate links and the disclosure, which is what keeps those platforms compliant
      with Associates\' platform whitelist.</div>
    </div>
  </div>

  <div class="cols2" style="margin-top:6pt">
    <div>
      <h3 class="first">The full round trip of one click</h3>
      <ol style="margin-left:14pt">
        <li style="font-size:8.5pt;color:var(--ink2);margin:3pt 0">Viewer sees the video on <b>YouTube</b>, hears "the link for that is below too".</li>
        <li style="font-size:8.5pt;color:var(--ink2);margin:3pt 0">Description carries four links: the product with <code>tolley-yt-20</code>, the shelf, <code>tolley.io/shop</code>, and the fit code with <code>utm_source=yt</code>.</li>
        <li style="font-size:8.5pt;color:var(--ink2);margin:3pt 0">Click the fit link → <b>tolley.io</b> logs the visit with its UTM → /hq Site tab.</li>
        <li style="font-size:8.5pt;color:var(--ink2);margin:3pt 0">Click "Shop on Amazon" → Amazon with the tag → commission lands under that subtag in Associates.</li>
        <li style="font-size:8.5pt;color:var(--ink2);margin:3pt 0">The posting run already wrote the video\'s URL and status into the <b>/hq Posts tab</b> via <code>api/hq/post-log</code>; the view counter picks it up from there.</li>
      </ol>
      <p class="small">That is the whole attribution chain: subtag = platform, UTM = page, post-log = video. Nothing else is instrumented.</p>
    </div>
    <div>
      <h3 class="first">Where the disclosure goes, per platform</h3>
      <table class="tight">
        <tr><th>Platform</th><th>Link style</th><th>Disclosure</th></tr>
        <tr><td>YouTube</td><td>Full affiliate + shelf + shop + fit</td><td>Line 2 of the description</td></tr>
        <tr><td>Facebook</td><td>Affiliate + fit</td><td>Caption + burned <code>#ad</code></td></tr>
        <tr><td>Instagram</td><td><b>No link</b> — "link in bio"</td><td>In caption</td></tr>
        <tr><td>Pinterest</td><td>Affiliate as the pin destination</td><td>Truncation protects the disclosure, never the hook — an Amazon link with no disclosure is a ToS strike</td></tr>
        <tr><td>TikTok</td><td>Text pointer only (captions can\'t carry links)</td><td>In caption</td></tr>
        <tr><td>X</td><td>Affiliate, <code>tolley-x-20</code></td><td><code>#ad (amazon affiliate)</code></td></tr>
        <tr><td>Bluesky / Threads</td><td>tolley.io/shop only</td><td>Plain <code>#ad</code></td></tr>
      </table>
      <div class="box blue">
        <p><b>Two disclosures, always.</b> One burned into the pixels for the whole 30 seconds, one in the
        caption text. Neither is optional and neither is conditional — the burn happens in ffmpeg before the
        file is written, so a video physically cannot exist without it.</p>
      </div>
    </div>
  </div>
`);


/* ─────────────────────────────────── 9. what it costs ──────────── */
const p9 = page(`
  <h2><span class="n">08</span>What it costs, and where</h2>
  <div class="sub">Figures are the renderer's own ledger, written into every video's JSON and pushed to the
  /hq Posts tab by <code>push-video-costs.mjs</code> after each run.</div>

  <div class="tiles">
    <div class="tile goldtop"><div class="num">$0.84</div><div class="lbl">Wan clips<br>7 × $0.12 on Modal L40S</div></div>
    <div class="tile goldtop"><div class="num">$0.20</div><div class="lbl">Kimi K3<br>script + storyboard</div></div>
    <div class="tile"><div class="num">~$0.09</div><div class="lbl">Gemini<br>gate + 7 keyframes + QA</div></div>
    <div class="tile greentop"><div class="num">$0.00</div><div class="lbl">voice, lip-sync,<br>assembly, captions</div></div>
  </div>

  <div class="cols2">
    <div>
      <h3 class="first">≈ $1.13 a video, ≈ $170 a month</h3>
      <table class="tight">
        <tr><th>Lane</th><th>Per week</th><th>Per month</th></tr>
        <tr><td>Treasures (2/day)</td><td>14</td><td>~61 · <b>$69</b></td></tr>
        <tr><td>Estate (1/day)</td><td>7</td><td>~30 · <b>$34</b></td></tr>
        <tr><td>Housing (1/day)</td><td>7</td><td>~30 · <b>$32</b></td></tr>
        <tr><td>W/D (1/week)</td><td>1</td><td>~4 · <b>$5</b></td></tr>
        <tr><td>Listings (Mon, ~6 cities)</td><td>~6</td><td>~26 · <b>≈$0</b></td></tr>
        <tr style="background:var(--goldwash)"><td><b>Total</b></td><td><b>~35</b></td><td><b>~151 videos · ~$140/mo</b></td></tr>
      </table>
      <p class="small">Compare: TubeGen quotes $1.94–2.47 <i>per minute</i>, Vidnoz $26.99/mo for 15 minutes
      total. At 151 × 30s you produce ~75 minutes a month for ~$140 — and you own the face, the voice and
      the wardrobe.</p>

      <h3>What the Aug 8 cost ruling actually did</h3>
      <ul>
        <li><b>45s → 30s</b>: 10 scenes → 7. Fewer paid clips <i>and</i> fewer paid keyframes. ~30% off.</li>
        <li><b>720p → 480×720</b>: ~$0.17 → ~$0.07 per i2v clip.</li>
        <li><b>12 → 8 sampler steps</b>: another ~33% off every clip and every retry.</li>
        <li><b>Face gates off</b>: they were spending up to 12 extra paid generations per video.</li>
        <li><b>Lip-sync → local</b>: was ~$0.90/video on Kling, now $0.</li>
        <li><b>Enhance + face-restore off</b>: no cash, but it gave back ~20 min of DGX GPU per video.</li>
      </ul>
    </div>
    <div>
      <h3 class="first">Where the <i>time</i> goes — and it is not the money</h3>
      <table class="tight">
        <tr><th>Stage</th><th>Wall clock</th><th>Cash</th></tr>
        <tr><td>Pick + images + vision gate</td><td>~5 min</td><td>~$0.01</td></tr>
        <tr><td>Kimi script + storyboard</td><td>~2 min</td><td>$0.20</td></tr>
        <tr><td>7 Gemini keyframes</td><td>~4 min</td><td>~$0.07</td></tr>
        <tr><td>Voice + fit</td><td>~3 min</td><td>$0</td></tr>
        <tr><td><b>7 Wan clips</b></td><td><b>~45 min</b></td><td><b>$0.84</b></td></tr>
        <tr><td>Assembly + captions + mux</td><td>~4 min</td><td>$0</td></tr>
        <tr><td>QA</td><td>~1 min</td><td>~$0.01</td></tr>
        <tr style="background:var(--wash)"><td><b>Measured, Aug 18</b></td><td><b>66 min</b></td><td><b>$1.04</b></td></tr>
      </table>
      <p class="small">Observed renders this week: 57, 63, 66, 87 min. The spread is almost entirely Modal
      queue time on the clip fan-out.</p>

      <div class="box gold">
        <p><b>The lever nobody uses.</b> <code>WAN_BACKEND=local</code> is already set — image-to-video
        clips prefer the DGX's own GPU on <code>:8190</code> for <b>$0</b> and only fall out to Modal
        per-clip on failure. But <code>SHORTS_ANIMATION=auto</code> sends every <i>face-visible</i> scene to
        <b>S2V, which has no local path</b> — and in the premium format she is in every scene. So in
        practice all 7 clips bill to Modal at $0.12 and the free local path never runs.</p>
        <p><b>That is your single biggest cost decision:</b> $0.84/video buys generation-time mouth sync.
        <code>SHORTS_ANIMATION=off</code> reverts to local i2v + local LatentSync — roughly <b>$0.00</b> in
        clips — at the cost of slower renders and a separate sync pass. Worth an A/B on one night's output.</p>
      </div>
    </div>
  </div>
`);

/* ──────────────────────────────────── 10. the knobs ────────────── */
const p10 = page(`
  <h2><span class="n">09</span>The knobs — where to change what</h2>
  <div class="sub">One file drives creative decisions across all five pipelines:
  <code>~/business-os/CREATIVE-SETTINGS.env</code>. A real environment variable of the same name always
  wins, so any wrapper can still override per-run.</div>

  <h3 class="first">Change these and every lane changes tonight</h3>
  <table class="tight">
    <tr><th style="width:26%">Setting</th><th style="width:10%">Now</th><th style="width:32%">What it actually controls</th><th>If you change it</th></tr>
    <tr><td><code>AD_VIDEO_TARGET_SECONDS</code></td><td><b>30</b></td><td>Video length — and therefore scene count, and therefore cost</td><td>45 → 10 scenes, ~+43% cash. 88 → 18 scenes. Hard-capped at 89s so FB/IG still auto-route to Reels.</td></tr>
    <tr><td><code>SHORTS_ANIMATION</code></td><td><b>auto</b></td><td>Motion engine per scene. auto = S2V for face shots (Modal, paid), i2v for the rest</td><td><code>off</code> = pure local i2v + LatentSync, near-$0 clips, slower, separate sync pass</td></tr>
    <tr><td><code>WAN_WIDTH</code>×<code>HEIGHT</code></td><td><b>480×720</b></td><td>Wan render resolution before the 1080×1920 upscale</td><td>720×1280 ≈ 2.7× pixels ≈ 2–2.5× clip cost. This is most of why clips read soft.</td></tr>
    <tr><td><code>WAN_STEPS</code></td><td><b>8</b></td><td>Sampler steps. Buys cleaner motion (fewer torn limbs), not more detail</td><td>12 was the old default — ~+50% clip cost</td></tr>
    <tr><td><code>PERSONA_OUTFIT_ROTATION</code></td><td><b>1</b></td><td>New outfit every video from <code>persona-wardrobe.json</code></td><td>0 = she reverts to the olive dress in the reference photo, forever</td></tr>
    <tr><td><code>PERSONA_GLAM_EVERY_N</code></td><td><b>4</b></td><td>Every 4th video pulls from the glam list instead</td><td>0 or 1 disables glam; standard rotation keeps running</td></tr>
    <tr><td><code>PERSONA_CAMERA_ROTATION</code></td><td><b>1</b></td><td>Real framing/lens/angle per scene + a genuine camera move on the clip</td><td>0 reverts to constant three-quarter framing and no movement</td></tr>
    <tr><td><code>PERSONA_FIT_CTA</code></td><td><b>1</b></td><td>The spoken "like the fit?" tail + the <code>tolley.io/fit</code> caption link</td><td>0 removes both. Note it costs you ~2s of the 30.</td></tr>
    <tr><td><code>SHORTS_FACE_GATES</code></td><td><b>off</b></td><td>Re-roll a scene when her eyes/mouth/extra-people check fails</td><td><code>audit</code> = measure only. <code>on</code> = up to <code>SHORTS_RETRY_TOTAL_CAP</code> extra <i>paid</i> generations per video</td></tr>
    <tr><td><code>SHORTS_ENHANCE</code></td><td><b>0</b></td><td>RIFE 4.9 interpolation + RealESRGAN upscale, locally, for $0</td><td>1 = measurably sharper (duplicate frame transitions 21%→0%) at ~+13 min GPU per video</td></tr>
    <tr><td><code>SHORTS_FACE_RESTORE</code></td><td><b>0</b></td><td>GFPGAN pass <i>after</i> lip-sync — the ordering fix for "eyes are a bit blurry"</td><td>1 at weight 0.7 = +23% eye detail. Do not exceed 0.8 or she goes porcelain.</td></tr>
    <tr><td><code>VIDEOS_PER_DAY</code></td><td><b>2</b></td><td>Treasures renders per night (env, set in the cron)</td><td>3 ≈ +$34/mo. Each one adds ~1 hour of overnight GPU.</td></tr>
  </table>

  <div class="cols2" style="margin-top:7pt">
    <div>
      <h3 class="first">Content files — edit these, not the code</h3>
      <dl class="kv">
        <dt><code>persona-wardrobe.json</code></dt><dd>every outfit she can wear · <code>~/business-os/</code></dd>
        <dt><code>persona-cinema.json</code></dt><dd>every camera move and framing · <code>~/business-os/</code></dd>
        <dt><code>character-ref.png</code></dt><dd>her face. One file, all four lanes.</dd>
        <dt><code>estate/briefs/*.json</code></dt><dd>30 estate scripts, day-of-year rotation</dd>
        <dt><code>wd-content/briefs/*.json</code></dt><dd>30 W/D scripts, same rotation</dd>
        <dt><code>persona-fit-catalog.json</code></dt><dd>what each fit code resolves to on tolley.io/fit</dd>
        <dt><code>gate-failed.json</code></dt><dd>ASINs benched for 14 days after a failed image gate</dd>
        <dt><code>posted.json</code></dt><dd>what has already been made, so nothing repeats</dd>
      </dl>
      <p class="small">Adding a brief is genuinely just dropping a JSON file in the folder — slug, title,
      pitch, offer, link, campaign, hashtags. The rotation picks it up the next day it comes round.</p>
    </div>
    <div>
      <h3 class="first">The three flags that decide "draft or live"</h3>
      <div class="box green">
        <p><code>growth-engine/shorts/AUTOPOST</code> &nbsp;<b>present ✓</b></p>
        <p><code>growth-engine/estate/AUTOPOST</code> &nbsp;<b>present ✓</b></p>
        <p><code>growth-engine/wd-content/AUTOPOST</code> &nbsp;<b>present ✓</b></p>
        <p>All three lanes are <b>live</b> right now. Delete the file and that lane renders to
        <code>review/</code> and Telegrams you a draft instead. <code>touch</code> it to go live again.
        Nothing else changes.</p>
      </div>
      <div class="box red">
        <p><b>The one you cannot flip from a file:</b> housing posts <i>in-run</i> at 06:45, not through the
        10:00 queue, so it has no AUTOPOST flag. It is gated by
        <code>HOUSING_LINKEDIN</code> / <code>HOUSING_PINTEREST</code> per leg only.</p>
      </div>
    </div>
  </div>
`);

/* ────────────────────────── 11. failure modes + cheat sheet ────── */
const p11 = page(`
  <h2><span class="n">10</span>Where it breaks, and what to type</h2>

  <div class="cols2">
    <div>
      <h3 class="first">The failure modes that have actually happened</h3>
      <table class="tight">
        <tr><th style="width:32%">Symptom</th><th>Cause &amp; the guard that now exists</th></tr>
        <tr><td><b>Lane renders 0 of 2, two nights running</b></td><td>The picker kept retrying the same 8 products that failed the image gate while 70+ untried ones waited. Fixed Aug 16 with the 14-day bench.</td></tr>
        <tr><td><b>Every video exactly 45.0s with dead air at the end</b></td><td>A length <i>floor</i> collided with the target when ads were cut to 45s — a 34s read padded to 45s while she kept mouthing. The floor is gone; length follows the narration.</td></tr>
        <tr><td><b>A ghost of her face slides across a cut</b></td><td>A dissolve between two face shots superimposes two versions of her. Two adjacent face shots are now always a hard cut.</td></tr>
        <tr><td><b>Smeared, torn, duplicated arms</b></td><td>Fast limb motion. The storyboard prompt now forbids waving/throwing/sweeping and anything passing near the lens.</td></tr>
        <tr><td><b>A random man appears in her scene</b></td><td>Wan hallucinating a second person. Fixed in the negative prompt — "second person, another person, disembodied hands".</td></tr>
        <tr><td><b>Psychedelic mush at the end of a clip</b></td><td>Wan drifting over the last ~10 frames. The FLF2V end-frame anchor (<code>AI_CLIP_HOLD</code>) holds it.</td></tr>
        <tr><td><b>Renders die mid-flight in the afternoon</b></td><td>OOM — the DGX cannot host a Wan render, vLLM and the workers in 128GB at once. Renders moved to 01:00–06:45 on Aug 9.</td></tr>
        <tr><td><b>License number truncated to KS 002518</b></td><td>ffmpeg drawtext drops a trailing char per multi-byte glyph. The band is drawn with PIL now.</td></tr>
        <tr><td><b>Nothing renders at all</b></td><td>Both script writers down. The cron probes Kimi, tries <code>docker start vllm_qwen36</code>, and only then gives up with a Telegram.</td></tr>
      </table>

      <div class="box gold">
        <p><b>The structural risk to watch.</b> Because every stage degrades instead of failing, a video can
        ship with 3 of 7 scenes as Ken Burns stills and a QA "pass". <code>SHORTS_DEGRADED_NOTE_AT=3</code>
        Telegrams you when that happens — worth confirming you actually receive those. It is the only
        signal separating "the lane is working" from "the lane is running".</p>
      </div>
    </div>
    <div>
      <h3 class="first">Copy-paste</h3>
      <div class="box">
        <p><b>Render one video right now, by hand</b></p>
        <p class="url">node ~/growth-engine/shorts/make-product-short.mjs --auto \\<br>&nbsp;&nbsp;--outdir ~/growth-engine/shorts/review</p>
        <p><b>Render a specific product</b></p>
        <p class="url">node ~/growth-engine/shorts/make-product-short.mjs \\<br>&nbsp;&nbsp;--product-id &lt;id&gt; --template punch-cut</p>
        <p><b>Render a specific brief</b></p>
        <p class="url">~/growth-engine/estate/estate-video.sh \\<br>&nbsp;&nbsp;~/growth-engine/estate/briefs/&lt;slug&gt;.json</p>
        <p><b>Post something that is sitting in review/</b></p>
        <p class="url">python3 ~/growth-engine/shorts/post-short.py \\<br>&nbsp;&nbsp;&lt;video.mp4&gt; &lt;meta.json&gt; --tt-account ruthann</p>
        <p><b>Retry one failed leg only</b></p>
        <p class="url">python3 ~/growth-engine/shorts/post-short.py \\<br>&nbsp;&nbsp;&lt;video.mp4&gt; &lt;meta.json&gt; --only ig</p>
      </div>
      <div class="box blue">
        <p><b>Go draft / go live</b></p>
        <p class="url">rm    ~/growth-engine/shorts/AUTOPOST&nbsp;&nbsp;# draft<br>touch ~/growth-engine/shorts/AUTOPOST&nbsp;&nbsp;# live</p>
        <p><b>Watch tonight's run</b></p>
        <p class="url">tail -f ~/growth-engine/shorts/logs/$(date +%F).log<br>journalctl --user -u growth-shorts -f</p>
        <p><b>What is queued for 10:00</b></p>
        <p class="url">cat ~/growth-engine/post-queue.jsonl | jq .</p>
        <p><b>Force the post-pass early</b></p>
        <p class="url">systemctl --user start post-pass.service</p>
        <p><b>See every timer</b></p>
        <p class="url">systemctl --user list-timers | grep -E \\<br>&nbsp;&nbsp;'estate|shorts|wd-|housing|listings|post-pass'</p>
      </div>

      <h3>Three things worth doing next</h3>
      <ol style="margin-left:14pt">
        <li style="font-size:8.6pt;color:var(--ink2);margin:3pt 0"><b>Settle the W/D cadence.</b> The script says daily, the timer says Monday. One of them is wrong and has been for two weeks.</li>
        <li style="font-size:8.6pt;color:var(--ink2);margin:3pt 0"><b>A/B <code>SHORTS_ANIMATION=off</code> for one night.</b> It is the difference between ~$1.04 and ~$0.20 a video. If the local i2v + LatentSync output is acceptable, that is ~$100/mo back.</li>
        <li style="font-size:8.6pt;color:var(--ink2);margin:3pt 0"><b>Turn <code>SHORTS_ENHANCE</code> back on.</b> It costs GPU time, not money, and the measured gain (0% duplicate frame transitions vs 21%) is the cheapest quality you have available.</li>
      </ol>
    </div>
  </div>

  <div class="box" style="margin-top:4pt;background:var(--wash)">
    <p class="small"><b>Sources.</b> Everything here was read off the DGX on Aug 18, 2026:
    <code>growth-engine/shorts/make-product-short.mjs</code> (2,550 lines) ·
    <code>daily-shorts-cron.sh</code> · <code>estate/estate-video.sh</code> ·
    <code>wd-content/wd-weekly-video.sh</code> · <code>post-pass.sh</code> ·
    <code>lib/persona-wardrobe.mjs</code> · <code>lib/postlog.sh</code> ·
    <code>shorts/{scene_frames,qa_check,classify_images,animate-clips,post-short}.py</code> ·
    <code>housing-hub/{run_daily,run_listings,housing_short}.py</code> ·
    <code>business-os/CREATIVE-SETTINGS.env</code> · <code>systemctl --user list-timers</code> ·
    the render JSON of the Aug 17–18 output of every lane · and a surviving working directory
    (<code>/tmp/short-EdIyZh</code>) for the stage-by-stage frames.</p>
  </div>
`);

/* ───────────────────────────── 12. V2: the cinema lane ───────── */
const p12 = page(`
  <h2><span class="n">12</span>Lady V2 — the cinema lane</h2>
  <div class="sub">A second renderer: <code>growth-engine/cinema/</code> → Seedance 2.0 ref-to-video on fal.ai.
  She is photoreal, handheld, and speaks her lines on camera in her own voice. First shipped video:
  <code>proof-estate-01</code>, 72 s, live on FB + YouTube 8/23.</div>

  <div class="tiles">
    <div class="tile goldtop"><div class="num">$57.39</div><div class="lbl">all-in, first proof<br>(incl. all retries + tests)</div></div>
    <div class="tile redtop"><div class="num">26 → 8</div><div class="lbl">paid generations<br>→ shipped shots (2.75×)</div></div>
    <div class="tile greentop"><div class="num">72 s</div><div class="lbl">8 clips · 9:16 · 720p<br>Seedance native voice</div></div>
    <div class="tile purpletop"><div class="num">2</div><div class="lbl">finished cuts<br>v1 posted · v2 unposted</div></div>
  </div>

  <div class="strip s4">
    ${frame2('v1-open.jpg', '0:01', ' the posted opener', false)}
    ${frame2('v1-mid.jpg', '0:30', ' living-room walkthrough', false)}
    ${frame2('v1-cta.jpg', '1:08', ' payoff + CTA', false)}
    ${frame2('v2cut-open.jpg', 'CUT 2', ' unposted alternate cut', false)}
  </div>

  <div class="cols2" style="margin-top:6pt">
    <div>
      <h3 class="first">The pipeline (all CLI, all resumable)</h3>
      <ul>
        <li><code>cinema script</code> — brief.json → Kimi-K3 plans 8 clips → <code>shotlist.json</code> + full printed preview. <b>Free. Nothing hits fal yet.</b></li>
        <li><code>cinema sheet</code> — 4-panel character sheet (Gemini) + inswapper face-lock → the ref pack</li>
        <li><code>cinema render</code> — the only paid step; queue at <code>queue.fal.run</code></li>
        <li><code>cinema qa</code> — ArcFace identity gate (≥0.45, faces ≥100 px only) + Gemini judge vs the sheet</li>
        <li><code>cinema retake</code> — re-render one clip (<code>--take=-t2</code> — equals sign required)</li>
        <li><code>cinema post</code> — trim, concat, music bed, burned POV labels, loudnorm −14 LUFS, CTA captions</li>
        <li><code>gallery.py</code> — phone-review page, every take, green border = the pick</li>
      </ul>
    </div>
    <div>
      <h3 class="first">Rate card (billed by <i>requested</i> seconds)</h3>
      <table>
        <tr><th>Tier</th><th>Rate</th><th>10 s clip</th></tr>
        <tr><td>720p 9:16 (used)</td><td><b>$0.3024/s</b></td><td>$3.02</td></tr>
        <tr><td>1080p</td><td>$0.682/s</td><td>$6.82</td></tr>
        <tr><td>mini 480p (tests)</td><td>$0.0696/s</td><td>$0.70</td></tr>
        <tr><td>chained clip</td><td>×0.6</td><td>$1.81</td></tr>
      </table>
      <div class="box blue" style="margin-top:4pt">
        <p><b>Budget guard.</b> <code>CINEMA_MAX_USD=60</code> in <code>common.py</code> hard-refuses any call that
        would cross the cap. The proof landed at <b>92%</b> of it. Every request is written to the project's
        <code>cost.json</code> with its fal request id — that file is the ledger of record.</p>
      </div>
      <div class="box" style="margin-top:4pt">
        <p><b>Review surfaces.</b> SMB share <code>[Cinema]</code> (Finder → <code>smb://192.168.2.104</code>, read-only)
        · tailnet gallery <code>gx10-adc6…ts.net:8444/&lt;project&gt;/</code> · never funnel it, never SMB the symlink dirs.</p>
      </div>
    </div>
  </div>
`);

/* ───────────────────── 13. the payload that worked ───────── */
const p13 = page(`
  <h2><span class="n">13</span>What we send to fal — the recipe that finally worked</h2>
  <div class="sub">This exact reference set + prompt grammar is what held her face, her outfit and her voice
  across 8 independent generations. It is now the <b>default</b> in <code>script.py</code> (fixed 8/23).</div>

  <div class="cols2">
    <div>
      <h3 class="first">The reference set, per clip</h3>
      <table>
        <tr><th>Slot</th><th>File</th><th>Why</th></tr>
        <tr><td><b>@Image1</b></td><td><code>pack/estate-a/front.png</code></td><td><b>FULL-BODY</b>, face-locked — the wardrobe anchor</td></tr>
        <tr><td>@Image2</td><td><code>pack/estate-a/bust.png</code></td><td>face detail</td></tr>
        <tr><td>@Image3</td><td><code>identity/front.jpg</code></td><td>identity ground truth</td></tr>
        <tr><td><b>@Audio1</b></td><td><code>voice/lady-anchor.wav</code></td><td>5.8 s of her own Seedance speech — timbre only</td></tr>
        <tr><td>@Video1</td><td>parent clip mp4</td><td>chained clips only (c03←c02, c07←c06, c08←c07)</td></tr>
      </table>
      <div class="box red" style="margin-top:4pt">
        <p><b>The $9 lesson.</b> The original default put <code>bust.png</code> first. Seedance then <i>invented her
        lower half</i> — the olive sweater dress came back as a crop top + denim shorts on three separate takes.
        <b>@Image1 must always be full-body.</b> <code>render.py</code> even had a "helper" that downgraded a full
        sheet back to the bust — removed 8/23.</p>
      </div>
      <div class="box" style="margin-top:4pt">
        <p><b>Identity chain.</b> AI-generated identity photos (real faces are refused by Seedance's filter) →
        Gemini 4-panel sheet → <code>face_lock.py</code> (inswapper) swaps her true face onto every panel → pack
        crops. Measured ArcFace vs ground truth: front 0.95, bust 0.95, profile 0.86.
        <b>Face packs expire ~30 days</b> on the fal side — regenerate every ~25.</p>
      </div>
    </div>
    <div>
      <h3 class="first">The prompt grammar</h3>
      <div class="box blue">
        <p style="font-style:italic">"Photoreal handheld selfie phone-vlog, slight micro-jitter, hyper-realistic, natural
        light, 9:16 vertical. The character in @Image1 (full-body reference — same face as @Image2 and @Image3;
        same outfit head to toe: same olive-green fine-knit sweater dress in every shot).
        <b>Shot 1 (0-3s):</b> … <b>Shot 2 (3-6s):</b> … <b>Shot 3 (6-10s):</b> …
        She says exactly: "I'm inside this Kansas City estate sale an hour before the line…"
        Use @Audio1 as her voice and timbre reference only; she speaks the quoted line exactly once, naturally,
        no echo, no repeated reads. Sound: quiet suburban morning, birdsong.
        No captions, no subtitles, no on-screen text, no lettering on boxes or props, no watermark."</p>
      </div>
      <ul>
        <li><b>Multi-shot inside one generation</b> — labelled <code>Shot N (a-bs):</code>, one primary action per shot, camera named every time.</li>
        <li><b>Native speech</b> — <code>She says exactly: "…"</code> + <code>generate_audio: true</code>. All 8 lines verified by whisper at 0.86–0.99 match.</li>
        <li><b>Positive descriptions only</b> — negations drift; describe what IS there.</li>
        <li><b>The no-text tail is load-bearing</b> — without it, boxes grow legible garbage lettering ("FIBESJA").</li>
        <li><b>Chained clips</b> open on "a NEW angle, do NOT match the final frame" — hard cut, not a morph.</li>
        <li><b>No seed input.</b> Seedance on fal exposes seed as <i>output only</i> — you cannot pin a look; you retake.</li>
        <li><b>Endpoint quirks:</b> ids carry no <code>fal-ai/</code> prefix; storage host is <code>rest.alpha.fal.ai</code>
        (legacy <code>rest.fal.ai</code> 403s on our key).</li>
      </ul>
    </div>
  </div>
`);

/* ───────────────── 14. THE BOX: what the proof cost + broke, pt 1 ── */
const p14 = page(`
  <h2><span class="n">14</span>⬛ What we learned — the money and the retries</h2>
  <div class="sub">Boxed post-mortem, part 1 — every number from <code>cost.json</code> and <code>run.log</code>.</div>

  <div class="box red">
    <div class="bt">💸 WHERE THE $57.39 WENT</div>
    <table>
      <tr><th>Wave</th><th>What</th><th>$</th></tr>
      <tr><td>smoke + packtest</td><td>4 clips @ 480p mini — proved the plumbing for pocket change</td><td>2.23</td></tr>
      <tr><td>r1</td><td>first 6 clips, VO-era</td><td>16.15</td></tr>
      <tr><td>unblock + c08</td><td>c07, c06 retake, c08 after the balance top-up</td><td>5.99</td></tr>
      <tr><td>-n native set</td><td><b>all 8 re-rendered</b> when we switched to Seedance native voice</td><td>19.19</td></tr>
      <tr><td>-n2 / -n3 retakes</td><td>5 more takes: wardrobe drift, identity dips, opener line</td><td>13.61</td></tr>
      <tr><td colspan="2"><b>Total — 26 paid generations for 8 shipped shots (14 retakes ≈ $25 was rework)</b></td><td><b>57.39</b></td></tr>
    </table>
    <p><b>Next one is budgeted ~$25–30:</b> the voice-mode flip-flop ($19.19) and the bust-ref wardrobe drift (~$9)
    are both now impossible by default — native voice and full-body @Image1 are baked into the generator.</p>
  </div>

  <div class="box gold" style="margin-top:5pt">
    <div class="bt">🔁 WHY EVERY RETAKE HAPPENED, RANKED</div>
    <p><b>1. Wardrobe drift (dominant).</b> Bust-only @Image1 → invented lower half, 3 takes burned. Fixed at the ref level, not the prompt level.</p>
    <p><b>2. Voice engine swap.</b> Built VO-first, then the Seedance native audio won — all 8 clips re-rendered. Decide voice mode <i>before</i> clip 1.</p>
    <p><b>3. Identity dips.</b> ArcFace min hit 0.06 (gate 0.45). Trust the gate on close shots; wide/back shots are judge-only.</p>
    <p><b>4. Prop + blocking misses.</b> Garbage lettering, not-Pyrex bowls, walking the wrong way. One retake each — patch the prompt, not the concept.</p>
    <p><b>5. Judge pedantry.</b> Two "retake" verdicts flipped to pass on the <i>same frames</i> once the rule softened. <b>Eyeball the strip before paying $3.</b></p>
  </div>

  <div class="box" style="margin-top:5pt">
    <div class="bt">⛔ THE 6.5-HOUR STALL</div>
    <p>fal balance ran out mid-run and surfaced as <b>HTTP 403 on the <i>storage upload</i></b> ("User is locked.
    Exhausted balance") — not on submit; easy to misread as an auth bug. The run sat 00:55→07:26 waiting on a ~$25
    top-up. <b>Check the fal balance before any overnight render.</b></p>
  </div>

  <div class="strip s3" style="margin-top:5pt">
    ${frame2('drift-c01n.jpg', 'DRIFT', ' bust-ref take: top + shorts, not the dress', true)}
    ${frame2('drift-c05n.jpg', 'DRIFT', ' same failure, clip 5 — midriff top', true)}
    ${frame2('fixed-c05n2.jpg', 'FIXED', ' full-body @Image1: the dress holds', true)}
  </div>
`);

/* ───────────── 15. THE BOX pt 2: upscale + audio ───────── */
const p15 = page(`
  <h2><span class="n">15</span>⬛ What we learned — the upscale failure and the audio</h2>

  <div class="box red">
    <div class="bt">📈 THE UPSCALE: 6 HOURS FOR "LOOKS ABOUT THE SAME"</div>
    <p>720p → 1440p via 4x-UltraSharp/ESRGAN (<code>tools/upscale.py</code>, frame-by-frame on the GB10):
    <b>6.0 hours, 1,739 frames at 12.4 s/frame, $0 cash — and rejected.</b> Verdict on the couch test:
    <i>"from a human eye standpoint it looks about the same."</i></p>
    <p><b>Why it can never work here:</b> Seedance output is AI-generated — there is no latent detail to recover,
    only plausible texture to invent. A static 1:1 crop looks dramatically better, and <b>that still-frame
    comparison is exactly what misled us</b>. Rule: never judge a video upscale on a still frame.</p>
    <p><b>If resolution ever matters: render native 1080p at fal ($0.682/s ≈ +$27 on a 72 s piece) — never upscale 720p.</b></p>
    <p class="small"><b>GB10 findings from the run:</b> fp16 is <i>slower</i> than fp32 here — use <code>--fp32</code> ·
    throughput halved the moment system RAM passed ~88% (CPU+GPU share one LPDDR5X pool — clear the box first) ·
    torch has no sm_121 kernels for this GPU, so the whole pass ran ~10× slow; fixing the torch build turns 6 h into ~20 min (open item).</p>
    <div class="strip s4" style="margin-top:3pt">
      <div></div>
      ${frame2('up-720.jpg', '720p', ' the shipped resolution', false)}
      ${frame2('up-1440.jpg', '1440p', ' 6 hours later', false)}
      <div></div>
    </div>
    <div style="margin-top:3pt"><img src="${img('v1-strip.jpg', IMG2)}" style="width:100%;border-radius:6px">
    <p class="small" style="margin-top:1pt"><b>FULL CUT</b> — 12-frame strip of the posted 72 s video.</p></div>
  </div>

  <div class="box gold" style="margin-top:5pt">
    <div class="bt">🔊 THE AUDIO SAGA — FIVE SEPARATE PROBLEMS</div>
    <p><b>1. Wrong engine first.</b> Built VO-first with the IndexTTS "Jessica" clone, then Jared heard Seedance's
    own native speech and chose it — the entire clip set was re-rendered ($19.19). Native is now the default.</p>
    <p><b>2. The opener says the wrong script — and it shipped.</b> The posted clip 1 speaks the <i>curb-find</i>
    line ("walking out to get the mail…") on an <i>estate-sale</i> video. The correct take exists — <code>c01-n3</code>,
    right line, right dress — but Jared called ship on the take that was up. It's still on disk, unused.</p>
    <p><b>3. A false alarm that cost $3.</b> Clip 5's whisper check scored 0.39 and triggered a retake — but it was a
    <i>two-speaker shot</i>: the cashier's line plus hers in one track, checked against her line only. Two-speaker
    clips need both lines in the transcript check.</p>
    <p><b>4. Inaudible music bed.</b> First mix put the lofi bed at −31 dB in the speech gaps — effectively silent.
    Raised +7.5 dB (<code>--music-gain</code>, now a flag). And the file Jared graded first was <code>assembled.mp4</code>
    — the no-music intermediate — because it sits next to <code>final.mp4</code> on the SMB share. Grade finals only.</p>
    <p><b>5. Every final shipped at 96 kHz.</b> <code>loudnorm</code> resamples internally and the AAC encoder clamps
    to 96 kHz unless pinned — off-spec for every platform, silently. <code>-ar 48000</code> now forced in
    <code>post.py</code> (fixed 8/23, verified by ffprobe).</p>
    <p class="small">Pronunciation nits that survived QA: "Pyrax" for Pyrex, "Tolia State Sales" for Tolley Estate
    Sales — spell risky words phonetically in the spoken line next time.</p>
  </div>

  <div class="box" style="margin-top:5pt">
    <div class="bt">🚚 SHIPPING BUGS (all fixed in code the same day)</div>
    <p>v1 went live on FB + YouTube <b>with no CTA links at all</b> — the video says "link below" over a bare caption
    (fixed live at 13:41; <code>cta_block()</code> now builds the tolley.io/estate + /fit links from settings) ·
    <code>post.py</code> wrote <code>platforms.fb.message</code> but the publisher reads <code>.caption</code> — FB was
    silently dropping the whole caption · the FB publish call had a 60 s timeout while FB transcodes the reel inside
    that call — every big reel failed and orphaned its upload; now 300 s.</p>
  </div>
`);

/* ───────────── 16. script preview + leftovers + playbook ───────── */
const p16 = page(`
  <h2><span class="n">16</span>Script first, spend second — and what's still on the shelf</h2>
  <div class="sub">Where the script came from, how to see it before it costs money, and the $16 of footage
  nobody has used yet.</div>

  <div class="cols2">
    <div>
      <h3 class="first">Where the script comes from</h3>
      <ul>
        <li><b>You write ~10 lines of <code>brief.json</code></b> — title, premise, open loop, payoff, CTA, 3 facts, locations, supporting cast.</li>
        <li><code>cinema script --project X</code> → <b>Kimi-K3</b> plans 6–8 clips against the Chloe format bible
        (55% selfie / 17% third-person / 11% inserts / 8% B-roll; open loop planted in the first 2 s, paid off in the
        last clip, one CTA). Free local fallback: <code>--provider vllm</code> (Qwen on :8356).</li>
        <li>Output is a plain, editable <code>shotlist.json</code> — every prompt, spoken line and ref, printed in
        full to the terminal. <b>Nothing touches fal until <code>cinema render</code> is a separate decision.</b></li>
      </ul>
      <h3>How to preview it better (all of this exists today)</h3>
      <ul>
        <li><b>Read the printed shotlist</b> — clip id, seconds, VO line, prompt head. Edit the JSON; the proof's shipped shotlist was hand-patched twice and both patches paid off.</li>
        <li><b>Telegram the shotlist for approval</b> before rendering — same gate the Vater lane runs (<code>stopAfterScript</code> → approve → spend). One paste, zero dollars.</li>
        <li><b>Proof the look for pennies</b> — render clip 1 only on <b>mini 480p ($0.70)</b> before committing the set at 720p.</li>
        <li>Sibling gates if you'd rather click than read: shorts <code>--script-only</code>, Vater preflight/estimate on /animate.</li>
      </ul>
    </div>
    <div>
      <h3 class="first">On the shelf right now (documented, not decided)</h3>
      <table>
        <tr><th>Asset</th><th>What it is</th></tr>
        <tr><td><b><code>final-2.mp4</code></b></td><td>A complete <b>second 72 s cut</b> built entirely from takes the posted
        video didn't use — sitting in <code>estate/review/…-v2.mp4</code>, unposted, $0 to finish</td></tr>
        <tr><td>6 unused takes</td><td>≈ <b>$16.33</b> of paid footage, incl. <code>c01-n3</code> — the opener with the
        <i>correct</i> line</td></tr>
        <tr><td>30 s teaser option</td><td>Best 3–4 unused takes re-cut short — noted as an option, no cut made</td></tr>
        <tr><td>~250 MB dead artifacts</td><td>rejected 1440p upscale, Jessica-VO cut, duplicate segments — untouched, listed for a later sweep</td></tr>
      </table>
      <div class="box green" style="margin-top:5pt">
        <div class="bt">✅ THE V2 PLAYBOOK — defaults now enforced in code</div>
        <p>Full-body @Image1, always · Seedance native voice, always · 8–10 s clips (billing is by <i>requested</i>
        seconds; ask for 15 only when the action needs it) · check fal balance before overnight runs · eyeball the QA
        strip before any paid retake · decide voice mode before clip 1 · proof at mini 480p first · never upscale —
        buy 1080p if it matters · grade <code>final.mp4</code>, never <code>assembled.mp4</code> · <code>--take=-t2</code>
        needs the equals sign.</p>
      </div>
    </div>
  </div>

  <div class="box" style="margin-top:4pt;background:var(--wash)">
    <p class="small"><b>V2 sources.</b> Read off the DGX on Aug 23, 2026: <code>cinema/projects/proof-estate-01/</code>
    (<code>cost.json</code> — 22 entries + fal request ids, <code>run.log</code>, <code>qa/transcripts-n.json</code>,
    <code>take-map*.json</code>, <code>final*.json</code>) · <code>cinema/{script,render,qa,post}.py</code> +
    <code>providers/seedance/fal.py</code> · <code>cinema/PRINCIPLES.md</code> · <code>tools/upscale.py</code> run log ·
    the live FB reel and YouTube Short. Posted: FB reel <code>1061448036257009</code> · YouTube <code>uwyYmpGAnf8</code>.</p>
  </div>
`);

/* ─────────────────────────────────────────────────────── build ── */
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Lady Video System V2 — how a video gets made, start to finish</title>
<style>${CSS}</style>
</head>
<body>
${p1}${p2}${p3}${p4}${p5}${p6}${p7}${p8}${p8b}${p9}${p10}${p11}${p12}${p13}${p14}${p15}${p16}
</body>
</html>`;

writeFileSync(OUT_HTML, html);
console.log('html written:', OUT_HTML, (html.length / 1e6).toFixed(2) + ' MB');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
await p.goto('file://' + OUT_HTML, { waitUntil: 'networkidle' });
await p.emulateMedia({ media: 'print' });
// Auto-fit: any page still running long gets a small zoom so nothing is ever
// clipped. Two passes — zoom reflows text, so the second pass catches the rest.
for (let pass = 0; pass < 3; pass++) {
  const shrunk = await p.evaluate(() => {
    const LIMIT = 11 * 96;
    const out = [];
    for (const el of document.querySelectorAll('.page')) {
      const inner = el.querySelector('.pinner');
      const PAD = (0.5 + 0.58) * 96;               // .page top+bottom padding
      const cur = parseFloat(inner.style.zoom || '1');
      const h = inner.getBoundingClientRect().height / cur;   // unscaled content height
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
