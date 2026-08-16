/**
 * Public marketing landing for /animate — shown to signed-out visitors
 * (signed-in users get the studio Shell). "Midnight screening room":
 * warm near-black, projector-amber, film grain, CSS-only motion.
 *
 * Rewritten 2026-08-15 for the invite-only public beta. Rules for this file:
 *
 *   1. Every number is real. Demo costs come from lib/vater/demo-videos.ts
 *      (reconciled all-in per render); the worked receipt is that same
 *      figure split by the published formula, not a mock-up.
 *   2. No demo plays until its subject has signed showcase consent — the
 *      page maps over LIVE_DEMOS, never DEMO_VIDEOS.
 *   3. Competitor figures are date-stamped, sourced from public pricing
 *      pages, and stated as prices and published limits only. No claims
 *      about anyone's quality, conduct or business.
 *   4. No fake artifacts. The old hero card showed an invented "$24.85"
 *      pipeline; it is gone, replaced by an actual finished video.
 */

import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { PIPELINE_STEPS, HELP_FAQ, HELP_SUPPORT_EMAIL } from "@/lib/vater/help-content";
import { APP_VERSION } from "@/lib/vater/changelog";
import { creditPackOptions } from "@/lib/vater/credit-packs";
import { getOpsRate } from "@/lib/vater/billing/ops-fee";
import {
  LIVE_DEMOS,
  PENDING_DEMO_COUNT,
  demoPerMinute,
} from "@/lib/vater/demo-videos";
import "./landing.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-jsl-serif",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-jsl-mono",
});

/* Until an invite-request form exists, "request an invite" is an email.
 * Keep it that way rather than shipping a form that drops leads. */
const INVITE = `mailto:${HELP_SUPPORT_EMAIL}?subject=Jelly%20Studio%20beta%20invite`;
const SIGNUP = "/signup?callbackUrl=%2Fanimate";
const SIGNIN = "/login?callbackUrl=%2Fanimate";

const PIPELINE = PIPELINE_STEPS;
const FAQ = HELP_FAQ;

/* ── prepaid credit packs ──────────────────────────────────────────────
 * Price, credit and fee all come from lib/vater/credit-packs.ts — the same
 * module the Checkout session and the ledger read, so the number printed
 * here cannot drift from the number Stripe charges. Never re-derive them
 * locally; that drift is exactly what this page exists not to do. */
const PACKS = creditPackOptions();
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/* ── what a finished video actually costs ─────────────────────────────
 * The compute a render used, at cost, plus a fixed rate per finished minute
 * of render operations. Every figure below is measured, not modelled.
 *
 * The ops rate is read live from getOpsRate() (env VATER_OPS_RATE_PER_MIN)
 * rather than typed here — this page is a server component, so it can share
 * the same source the receipt chips and the Billing screen read. Hardcoding
 * it would make the marketing page the one surface that silently goes stale
 * when Jared changes the rate. */
const BETA_MAX_MINUTES = "9:00";
const BENCHMARK = { length: "8:44", allIn: "$5.56" };
/* Measured across recent renders — the ops half is fixed, the compute half
 * genuinely is not, and the page should not imply otherwise. */
const COMPUTE_RANGE = "$0.16 – $0.55";

/* ── competitor $/minute, checked 2026-08-15 ──────────────────────────
 * Public pricing pages only; "notes" are published plan limits, nothing
 * more. Re-check before any redeploy that changes these rows. */
const COMPARISON_DATE = "15 August 2026";
interface ComparisonRow {
  name: string;
  rate: string;
  note: string;
  ours?: boolean;
}
const COMPARISON: readonly ComparisonRow[] = [
  { name: "Jelly Studio", rate: "$0.55 – $0.95", note: "no subscription · beta cap 9:00", ours: true },
  { name: "Zebracat", rate: "$0.50 – $1.30", note: "5-minute cap" },
  { name: "StoryShort", rate: "$0.58 – $1.56", note: "" },
  { name: "NoLang", rate: "$0.76 – $1.00", note: "3-minute cap on Standard" },
  { name: "Vidnoz", rate: "$1.33 – $1.80", note: "60-minute cap" },
  { name: "Argil", rate: "$1.49 – $1.56", note: "" },
  { name: "TubeGen", rate: "$1.94 – $2.47", note: "30-minute cap · no free trial · no refunds" },
];

/* ── what is in the beta ──────────────────────────────────────────────
 * Only things a beta user can click today. Anything unbuilt stays off. */
const FEATURES = [
  ["Script writer", "Paste a script you already wrote, or generate one and edit every word of it."],
  ["Cloned & custom voices", "Bring a voice or build one, then shape it in the Voice Tuner — a real EQ studio, not a slider."],
  ["Consistent characters", "The same faces and the same art style hold from the first scene to the last."],
  ["Generated scenes", "Every beat is a cinematic frame made for that line. No stock library, ever."],
  ["Wan2.2 motion", "Animate the scenes that earn it and leave the rest as stills. Per scene, your call."],
  ["7-step editor", "Script, voice, visuals, music, captions, review, publish — you can stop and resume at any step."],
  ["Project library", "Everything you have made stays openable and re-renderable. Nothing expires."],
  ["Upload your own media", "Reference images and clips of your own go straight into the render."],
  ["Publish or download", "Push to YouTube from the studio, or download the MP4 and feed any scheduler you already use."],
  ["Live render receipt", "Compute, ops and wall-clock time, itemised, for every video you finish."],
  ["A real feedback box", "It files a ticket, not an auto-reply. Beta is small on purpose so the replies are human."],
  [`Versioned changelog (v${APP_VERSION})`, "Every change is dated and written for you, not for a commit log."],
] as const;

/* The three failure modes that make AI video read as slop, and what Jelly
 * does instead. Claims only about our own pipeline — no rival named. */
const SLOP_FIXES = [
  {
    label: "Robotic voice",
    problem:
      "Synthetic narration flattens out on long sentences — the cadence goes level and the breath disappears about ninety seconds in.",
    fix: "A cloned voice with word-level timing, tuned in an EQ studio you control, so the delivery holds through a nine-minute script and the captions land on the syllable.",
  },
  {
    label: "Stock B-roll",
    problem:
      "The same handshake clip loops behind every third point until the viewer stops looking at the screen.",
    fix: "Nothing is pulled from a library. Every beat of your script becomes its own generated scene, in one art style you lock for the whole channel.",
  },
  {
    label: "Lip-sync drift",
    problem:
      "A mouth pasted onto a face slips a few frames and the entire video reads as fake, however good the writing was.",
    fix: "No pasted-on mouths. Scenes are generated whole, and motion is added per scene with Wan2.2 when it helps the shot — off by default, priced before you click.",
  },
] as const;

export function AnimateLanding(): React.ReactElement {
  const featured = LIVE_DEMOS[0];
  const rest = LIVE_DEMOS.slice(1);

  const opsRate = getOpsRate();
  const opsRateLabel = `$${opsRate.toFixed(2)}`;
  /** The render-ops half of the bill for a finished video of this length. */
  const opsFee = (durationSec: number) => (durationSec / 60) * opsRate;

  return (
    <div className={`jsl ${display.className} ${serif.variable} ${mono.variable}`}>
      <div className="jsl-wrap">
        {/* nav */}
        <nav className="jsl-nav">
          <a className="jsl-mark" href="/animate">
            JELLY<em>·</em>STUDIO <span>BY TOLLEY.IO</span>
          </a>
          <div className="jsl-nav-links">
            <span className="jsl-verpill">v{APP_VERSION} · public beta</span>
            <a href="#reel">Demos</a>
            <a href="#pricing">Pricing</a>
            <a href="#craft">Craft</a>
            <a href="#faq">FAQ</a>
            <a href={SIGNIN}>Sign in</a>
            <a className="jsl-btn jsl-btn-amber" href={INVITE}>Request an invite</a>
          </div>
        </nav>

        {/* hero */}
        <header className="jsl-hero">
          <div>
            <div className="jsl-badge jsl-rev d1">PUBLIC BETA · INVITE ONLY</div>
            <h1 className="jsl-h1 jsl-rev d2">
              Type a script.<br />
              Get a finished <span className="it">video.</span>
            </h1>
            <p className="jsl-sub jsl-rev d3">
              Faceless long-form, written by you: cloned voice, generated
              cinematic scenes, optional motion, captions and soundtrack —
              composed, downloadable, no watermark.{" "}
              <strong>
                You pay the compute it used, at cost, plus {opsRateLabel} per
                finished minute of render operations. A typical long-form video
                lands between $1 and $7 all in.
              </strong>{" "}
              No subscription, ever.
            </p>
            <div className="jsl-hero-ctas jsl-rev d4">
              <a className="jsl-btn jsl-btn-amber" href={INVITE}>Request an invite</a>
              <a className="jsl-btn jsl-btn-ghost" href={SIGNUP}>
                Have an invite code? Sign up
              </a>
            </div>
            <div className="jsl-cta-note jsl-rev d5">
              $10 PROMOTIONAL STARTER CREDIT ONCE A CARD IS ON FILE — STRIPE $0
              HOLD, NOTHING CHARGED UNTIL YOU SPEND IT · IT COVERS SCRIPTS,
              VOICE AND STILL SCENES; ANIMATED MOTION NEEDS PURCHASED CREDIT ·
              FAILED RENDERS ARE NEVER CHARGED · BETA MAXIMUM LENGTH{" "}
              {BETA_MAX_MINUTES}
            </div>
          </div>

          {/* the reel opener: a real finished render, not a mockup */}
          {featured ? (
            <figure className="jsl-screen jsl-rev d3">
              <div className="jsl-screen-head">
                <span>NOW SHOWING — MADE IN JELLY STUDIO</span>
                <span className="run">{featured.duration}</span>
              </div>
              <video
                className="jsl-video"
                src={featured.url}
                poster={featured.poster}
                preload="none"
                controls
                playsInline
                aria-label={`Demo video: ${featured.title}`}
              />
              <figcaption className="jsl-screen-foot">
                <span className="ttl">{featured.title}</span>
                <span className="cost">
                  {`$${featured.allInUsd.toFixed(2)}`}{" "}
                  <small>all in · {demoPerMinute(featured)}</small>
                </span>
              </figcaption>
            </figure>
          ) : null}
        </header>

        {/* pipeline strip */}
        <section className="jsl-pipeline">
          {PIPELINE.map((s) => (
            <div className="jsl-step" key={s.n}>
              <div className="n">{s.n}</div>
              <div className="t">{s.t}</div>
              <div className="d">{s.d}</div>
            </div>
          ))}
        </section>

        {/* the reel — real renders only, gated on written consent */}
        <section className="jsl-section" id="reel">
          <div className="jsl-eyebrow">The reel</div>
          <h2 className="jsl-h2">
            Everything here came out of the <span className="it">studio.</span>
          </h2>
          <p className="jsl-sub" style={{ maxWidth: 620 }}>
            Real customer renders, with the real all-in cost printed on each
            one. We only publish a video once the person who wrote it has signed
            off — so the shelf fills up slower than it could.
          </p>
          <div className="jsl-reel">
            {rest.map((d) => (
              <figure className="jsl-demo" key={d.id}>
                <video
                  className="jsl-video"
                  src={d.url}
                  poster={d.poster}
                  preload="none"
                  controls
                  playsInline
                  aria-label={`Demo video: ${d.title}`}
                />
                <figcaption>
                  <span className="ttl">{d.title}</span>
                  <span className="meta">
                    {d.duration} · ${d.allInUsd.toFixed(2)} all in ·{" "}
                    {demoPerMinute(d)}
                  </span>
                  <span className="blurb">{d.blurb}</span>
                </figcaption>
              </figure>
            ))}
            {PENDING_DEMO_COUNT > 0 ? (
              /* Until a second demo clears consent there is nothing to sit
               * beside, so the placeholder spans the row as a panel rather
               * than floating as one lonely card in an empty grid. */
              <div className={`jsl-soon${rest.length === 0 ? " wide" : ""}`}>
                <div className="slate">
                  <span className="cue" aria-hidden="true">●</span>
                  <span>
                    {PENDING_DEMO_COUNT} more
                    <br />
                    demos coming
                  </span>
                </div>
                <div className="say">
                  <span className="ttl">Awaiting sign-off</span>
                  <span className="blurb">
                    {PENDING_DEMO_COUNT} finished videos — including the{" "}
                    {BENCHMARK.length} long-form benchmark that cost{" "}
                    {BENCHMARK.allIn} to render — are cut and sitting in the
                    library. They go up the day their writers sign the release,
                    and not a day sooner. The one playing above is the first
                    that cleared.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* what "not slop" actually means — named failure modes, no rivals */}
        <section className="jsl-section" id="craft">
          <div className="jsl-eyebrow">Craft</div>
          <h2 className="jsl-h2">
            Three ways AI video goes <span className="it">wrong.</span>
          </h2>
          <p className="jsl-sub" style={{ maxWidth: 560 }}>
            Every one of these is a specific, fixable failure. Here is what
            happens instead.
          </p>
          <div className="jsl-craft">
            {SLOP_FIXES.map((f) => (
              <div className="jsl-craft-cell" key={f.label}>
                <div className="tag">{f.label}</div>
                <div className="bad">{f.problem}</div>
                <div className="good">{f.fix}</div>
              </div>
            ))}
          </div>
        </section>

        {/* what you get */}
        <section className="jsl-section" id="features">
          <div className="jsl-eyebrow">In the beta</div>
          <h2 className="jsl-h2">
            The whole studio, <span className="it">unlocked.</span>
          </h2>
          <p className="jsl-sub" style={{ maxWidth: 560 }}>
            There are no tiers and nothing is held back for a higher plan.
            Everything below is in the build you get on day one.
          </p>
          <div className="jsl-feat">
            {FEATURES.map(([t, d]) => (
              <div className="jsl-feat-cell" key={t}>
                <div className="t">{t}</div>
                <div className="d">{d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* pricing */}
        <section className="jsl-section" id="pricing">
          <div className="jsl-eyebrow">Pricing</div>
          <h2 className="jsl-h2">
            Compute at cost.<br />
            Plus <span className="it">{opsRateLabel}</span> a minute.
          </h2>

          <div className="jsl-price-hero">
            <div className="jsl-bigprice">
              {opsRateLabel}
              <small> / finished minute of render operations, + compute at cost</small>
            </div>
            {/* Each <li> is a flex row: the em-dash marker, then ONE span.
              * Put inline markup directly in the <li> and it becomes a second
              * flex item that breaks out of the sentence. */}
            <ul className="jsl-price-points">
              <li>
                <span>
                  A typical long-form video runs{" "}
                  <strong>$1 to $7 all in</strong>. Our {BENCHMARK.length}{" "}
                  benchmark render cost {BENCHMARK.allIn}.
                </span>
              </li>
              <li>
                <span>
                  Compute is passed through at what it actually cost to render
                  your video, and it genuinely varies — {COMPUTE_RANGE} per
                  finished minute across recent renders. The ops half is the
                  fixed, predictable one.
                </span>
              </li>
              <li>
                <span>Failed renders are never charged. Not partially, not at all.</span>
              </li>
              <li>
                <span>
                  If a render overruns its estimate on repair passes, your bill
                  is capped at the estimate and we absorb the rest.
                </span>
              </li>
              <li>
                <span>
                  No subscription, no seat fee, no monthly minimum. Credit you
                  buy does not expire.
                </span>
              </li>
              <li>
                <span>
                  Beta maximum length is {BETA_MAX_MINUTES}. It is proven clean
                  to just under nine minutes; longer is coming.
                </span>
              </li>
            </ul>
          </div>

          {/* prepaid packs, with the Stripe fee shown rather than buried */}
          <h3 className="jsl-h3">Prepaid credit packs</h3>
          <p className="jsl-fine">
            You buy credit up front and spend it a render at a time. A $10 pack
            is {dollars(PACKS[0].creditsCents)} of credit — the difference is
            Stripe&rsquo;s card processing fee, and we do not add anything on
            top of it. We would rather print that than round the price to
            $10.61 and hide it.
          </p>
          <div className="jsl-packs">
            {PACKS.map((p) => (
              <div className="jsl-pack" key={p.pack}>
                <div className="g">{dollars(p.priceCents)}</div>
                <div className="n">
                  {dollars(p.creditsCents)} <span>of credit</span>
                </div>
                <div className="f">{dollars(p.feeCents)} Stripe fee</div>
              </div>
            ))}
          </div>

          {/* the formula, worked on a video you can watch further up */}
          {featured ? (
            <>
              {/* Line names and order match the in-app receipt chips exactly
                * ("Compute · Render ops (min × rate) · Total"), so the first
                * receipt a new user sees has the shape this page promised. */}
              <h3 className="jsl-h3">
                A real {featured.duration} video, itemised
              </h3>
              <div className="jsl-receipt">
                <div className="row">
                  <span className="k">Compute</span>
                  <span className="v">
                    ${(featured.allInUsd - opsFee(featured.durationSec)).toFixed(2)}
                  </span>
                </div>
                <div className="row">
                  <span className="k">Render ops</span>
                  <span className="v">
                    ${opsFee(featured.durationSec).toFixed(2)}{" "}
                    <em>
                      ({(featured.durationSec / 60).toFixed(1)} min ×{" "}
                      {opsRateLabel})
                    </em>
                  </span>
                </div>
                <div className="row total">
                  <span className="k">Total — {featured.title}</span>
                  <span className="v">${featured.allInUsd.toFixed(2)}</span>
                </div>
              </div>
              <p className="jsl-fine">
                That is a receipt from the video playing at the top of this
                page, not a quote for yours. The render-ops half is fixed at{" "}
                {opsRateLabel} a finished minute; the compute half depends on
                what your scenes actually take to make. The studio shows you
                this receipt while the render is still running, not a month
                later.
              </p>
            </>
          ) : null}
        </section>

        {/* date-stamped comparison */}
        <section className="jsl-section" id="compare">
          <div className="jsl-eyebrow">For comparison</div>
          <h2 className="jsl-h2">
            What the rest of the shelf <span className="it">charges.</span>
          </h2>
          <div className="jsl-table-scroll">
            <table className="jsl-table">
              <caption className="jsl-sr">
                Published price per finished minute across faceless AI video
                tools, checked {COMPARISON_DATE}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Tool</th>
                  <th scope="col">Per finished minute</th>
                  <th scope="col">Published limits</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.name} className={row.ours ? "ours" : undefined}>
                    <th scope="row">{row.name}</th>
                    <td className="rate">{row.rate}</td>
                    <td className="note">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="jsl-fine">
            Figures read off each vendor&rsquo;s public pricing page on{" "}
            {COMPARISON_DATE}, converted to dollars per finished minute.
            Subscription rates assume 100% of the monthly quota is used — leave
            any of it unused and the real rate is higher. Plans change; check
            before you buy. Our own range is measured across recent long-form
            renders, all in.
          </p>
        </section>

        {/* how billing works, plainly */}
        <section className="jsl-section" id="how-billing-works">
          <div className="jsl-eyebrow">Billing, plainly</div>
          <h2 className="jsl-h2">
            You are never billed for a <span className="it">month.</span>
          </h2>
          <p className="jsl-sub" style={{ maxWidth: 620 }}>
            Put a card on file and Stripe places a $0 verification hold —
            nothing is charged. A $10 promotional starter credit lands on your
            balance, and it covers the stills pipeline: scripts, transcripts,
            voice and still scenes. Animated motion runs on purchased credit
            only, so a fully animated video means topping up first — we would
            rather say that here than let you find it at the render button.
            Top up with a pack whenever you want to; there is no minimum and no
            renewal date. Every render draws down the balance by its own
            itemised cost, and the receipt shows compute, ops and wall-clock
            time. Stop by not rendering — there is nothing to cancel.
          </p>
        </section>

        {/* FAQ */}
        <section className="jsl-section" id="faq">
          <div className="jsl-eyebrow">Questions</div>
          <h2 className="jsl-h2">The fine print, <span className="it">unfined.</span></h2>
          <div className="jsl-faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <div className="a">{f.a}</div>
              </details>
            ))}
          </div>
        </section>

        {/* beta terms */}
        <section className="jsl-section" id="beta">
          <div className="jsl-eyebrow">About the beta</div>
          <h2 className="jsl-h2">
            Small on purpose, <span className="it">documented</span> in public.
          </h2>
          <p className="jsl-sub" style={{ maxWidth: 620 }}>
            Jelly Studio is invite-only while the render fleet is small enough
            that everyone gets the whole machine. Every build is dated in the
            changelog — this is v{APP_VERSION} — and the feedback box inside the
            studio files a real ticket that a person reads.
          </p>
          <div className="jsl-beta-links">
            <a href="/animate/beta">Beta program terms</a>
            <a href="/animate/terms">Terms of service</a>
            <a href="/animate/privacy">Privacy</a>
            <a href={`mailto:${HELP_SUPPORT_EMAIL}`}>{HELP_SUPPORT_EMAIL}</a>
          </div>
        </section>

        {/* final CTA */}
        <section className="jsl-final">
          <div className="jsl-eyebrow">Roll credits</div>
          <h2 className="jsl-h2">
            Ask for an <span className="it">invite.</span>
          </h2>
          <p className="jsl-sub" style={{ margin: "0 auto 28px", maxWidth: 520 }}>
            Tell us what you want to make. Invites go out in small batches, and
            a $10 starter credit — enough to take a script all the way to
            finished still scenes — is waiting on the other side of the card
            form.
          </p>
          <div className="jsl-final-ctas">
            <a className="jsl-btn jsl-btn-amber" href={INVITE}>Request an invite</a>
            <a className="jsl-btn jsl-btn-ghost" href={SIGNUP}>
              Have an invite code? Sign up
            </a>
          </div>
        </section>

        <footer className="jsl-foot">
          <span>JELLY·STUDIO BY TOLLEY.IO — KANSAS CITY, MO</span>
          <span className="jsl-foot-links">
            <a href="/animate/terms">Terms</a>
            <a href="/animate/privacy">Privacy</a>
            <a href="/animate/beta">Beta</a>
            <span>v{APP_VERSION} · public beta</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
