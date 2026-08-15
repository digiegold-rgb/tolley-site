/**
 * Public marketing landing for /animate — shown to signed-out visitors
 * (signed-in users get the studio Shell). "Midnight screening room":
 * warm near-black, projector-amber, film grain, CSS-only motion.
 *
 * Every number on this page comes from lib/vater/pricing.ts — the same
 * module the billing gates charge from. No invented metrics, no fake
 * testimonials: the product is new and the page doesn't pretend otherwise.
 */

import { Bricolage_Grotesque, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import {
  ANIMATION_PRICES,
  FLAT_ACTION_PRICES,
  formatPrice,
} from "@/lib/vater/pricing";
import { VATER_TRIAL_CAPS } from "@/lib/vater-subscription";
import { PIPELINE_STEPS, HELP_FAQ } from "@/lib/vater/help-content";
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

const SIGNUP = "/signup?callbackUrl=%2Fanimate";
const SIGNIN = "/login?callbackUrl=%2Fanimate";

const PIPELINE = PIPELINE_STEPS;

const FLAT_LABELS: Record<keyof typeof FLAT_ACTION_PRICES, string> = {
  script: "Script generation",
  voiceover: "Voiceover",
  scene: "Scene image",
  render: "Video compose",
  thumbnail: "Thumbnail",
  description: "Description",
  transcription: "Transcription",
};

const FAQ = HELP_FAQ;

/* The three failure modes that make AI video read as slop, and what Jelly
 * does instead. Claims only about our own pipeline — no rival named, no
 * rival price quoted. */
const SLOP_FIXES = [
  {
    problem:
      "Synthetic narration falls apart on long sentences — the cadence flattens and the breath disappears.",
    fix: "A cloned voice with word-level timing, so captions land on the syllable and the delivery holds through a full paragraph.",
  },
  {
    problem:
      "The same stock B-roll loops behind every point until the viewer stops looking.",
    fix: "Every beat of the script becomes its own generated scene, in one art style you lock for the whole channel.",
  },
  {
    problem: "Lip-sync drifts a few frames and the whole thing reads as fake.",
    fix: "No pasted-on mouths. Motion is generated with Wan2.2 (or Hunyuan, Kling, Veo, Luma) per scene, your call, at a price you see first.",
  },
] as const;

export function AnimateLanding(): React.ReactElement {
  // Featured tiers for the price grid: cheapest budget, the workhorse, the flagship.
  const featured = [
    { key: "ltx-local", note: "budget" },
    { key: "modal-hunyuan-narrative", note: "workhorse" },
    { key: "kling-master", note: "flagship" },
  ] as const;

  const tiers = Object.entries(ANIMATION_PRICES);

  return (
    <div className={`jsl ${display.className} ${serif.variable} ${mono.variable}`}>
      <div className="jsl-wrap">
        {/* nav */}
        <nav className="jsl-nav">
          <a className="jsl-mark" href="/animate">
            JELLY<em>·</em>STUDIO <span>BY TOLLEY.IO</span>
          </a>
          <div className="jsl-nav-links">
            <a href="#pricing">Pricing</a>
            <a href="#craft">Craft</a>
            <a href="#faq">FAQ</a>
            <a href={SIGNIN}>Sign in</a>
            <a className="jsl-btn jsl-btn-amber" href={SIGNUP}>Start free — no card</a>
          </div>
        </nav>

        {/* hero */}
        <header className="jsl-hero">
          <div>
            <div className="jsl-kicker jsl-rev d1">Faceless video studio</div>
            <h1 className="jsl-h1 jsl-rev d2">
              Type a topic.<br />
              Publish a <span className="it">video.</span>
            </h1>
            <p className="jsl-sub jsl-rev d3">
              Script, cloned voiceover, cinematic scenes, real motion, captions,
              soundtrack — composed and pushed to five platforms from one
              timeline. <strong>No subscription. Pay per video, ~$25 each.</strong>
            </p>
            <div className="jsl-hero-ctas jsl-rev d4">
              <a className="jsl-btn jsl-btn-amber" href={SIGNUP}>
                Start free — {VATER_TRIAL_CAPS.transcripts} transcripts,{" "}
                {VATER_TRIAL_CAPS.scenes} scene, {VATER_TRIAL_CAPS.animations} animation
              </a>
              <a className="jsl-btn jsl-btn-ghost" href="#pricing">See every price</a>
            </div>
            <div className="jsl-cta-note jsl-rev d5" style={{ marginTop: 16 }}>
              NO CARD REQUIRED · {VATER_TRIAL_CAPS.transcripts} TRANSCRIPTS,{" "}
              {VATER_TRIAL_CAPS.scenes} SCENE GENERATION,{" "}
              {VATER_TRIAL_CAPS.animations} ANIMATION FREE · ENDS AT A CAP, NOT A DATE
            </div>
          </div>

          {/* the live render-timeline demo card */}
          <div className="jsl-render jsl-rev d3" aria-hidden="true">
            <div className="jsl-render-head">
              <span>JELLY·STUDIO — RENDER PIPELINE</span>
              <span className="rec">REC</span>
            </div>
            <div className="jsl-topic"><span>why nobody builds cathedrals anymore</span></div>
            <div className="jsl-phases">
              {[
                ["script", "100%"],
                ["voiceover", "100%"],
                ["scenes ×15", "100%"],
                ["animate ×4", "100%"],
                ["compose", "done"],
              ].map(([label, pct]) => (
                <div className="jsl-phase" key={label}>
                  <span>{label}</span>
                  <span className="bar"><i /></span>
                  <span className="pct">{pct}</span>
                </div>
              ))}
            </div>
            <div className="jsl-render-foot">
              <span className="lbl">This video cost</span>
              <span className="amt">$24.85 <small>charged after success</small></span>
            </div>
          </div>
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

        {/* what "not slop" actually means — concrete failure modes, no rivals named */}
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
              <div className="jsl-craft-cell" key={f.problem}>
                <div className="bad">{f.problem}</div>
                <div className="good">{f.fix}</div>
              </div>
            ))}
          </div>
        </section>

        {/* pricing */}
        <section className="jsl-section" id="pricing">
          <div className="jsl-eyebrow">Pricing</div>
          <h2 className="jsl-h2">
            No subscription.<br />Pay for the <span className="it">video,</span> not the month.
          </h2>

          <div className="jsl-price-hero">
            <div className="jsl-bigprice">
              ~$25<small> / typical video</small>
            </div>
            <ul className="jsl-price-points">
              <li>Card on file, invoiced automatically at $25 of usage</li>
              <li>Exact cost shown before every render — confirm, then it runs</li>
              <li>Failed renders are never charged, by design</li>
              <li>Set your own monthly spend limit; we stop when you say stop</li>
            </ul>
          </div>

          <div className="jsl-price-grid">
            {Object.entries(FLAT_ACTION_PRICES).map(([key, spec]) => (
              <div className="jsl-price-cell" key={key}>
                <div className="l">{FLAT_LABELS[key as keyof typeof FLAT_ACTION_PRICES]}</div>
                <div className="p">{formatPrice(spec.priceCents)}<span> {spec.unit}</span></div>
              </div>
            ))}
            {featured.map(({ key, note }) => {
              const spec = ANIMATION_PRICES[key as keyof typeof ANIMATION_PRICES];
              return (
                <div className="jsl-price-cell" key={key}>
                  <div className="l">Animation — {spec.label} · {note}</div>
                  <div className="p">{formatPrice(spec.priceCents)}<span> /clip</span></div>
                </div>
              );
            })}
          </div>

          <div className="jsl-trial">
            <span className="jsl-trial-chip">FREE TIER · {VATER_TRIAL_CAPS.transcripts} TRANSCRIPTS</span>
            <span className="jsl-trial-chip">{VATER_TRIAL_CAPS.scenes} SCENE GENERATION</span>
            <span className="jsl-trial-chip">{VATER_TRIAL_CAPS.animations} ANIMATION</span>
            <span className="jsl-trial-chip">NO CARD · NO CLOCK</span>
          </div>
        </section>

        {/* tier marquee */}
        <div className="jsl-marquee" aria-hidden="true">
          <div className="jsl-marquee-track">
            {[0, 1].map((dup) => (
              <div key={dup} style={{ display: "flex", gap: 44 }}>
                {tiers.map(([key, spec]) => (
                  <span className="jsl-tier" key={`${dup}-${key}`}>
                    <b>{spec.label}</b>
                    <span className="pr">{formatPrice(spec.priceCents)}/clip</span>
                    <span className="eta">{spec.etaLabel}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* publish */}
        <section className="jsl-section">
          <div className="jsl-eyebrow">Distribution</div>
          <h2 className="jsl-h2">One timeline, <span className="it">five</span> platforms.</h2>
          <div className="jsl-publish">
            {["YouTube", "TikTok", "Instagram", "Facebook", "Pinterest"].map((p) => (
              <span className="jsl-pub" key={p}>{p}</span>
            ))}
          </div>
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

        {/* how billing works, plainly */}
        <section className="jsl-section" id="how-billing-works">
          <div className="jsl-eyebrow">Billing, plainly</div>
          <h2 className="jsl-h2">
            You are never billed for a <span className="it">month.</span>
          </h2>
          <p className="jsl-sub" style={{ maxWidth: 620 }}>
            There is no plan to pick and no tier to outgrow. You add a card,
            and each action bills at the fixed price listed above — script,
            voiceover, each scene image, each animated clip, the compose. The
            charges sit on your account and your card is invoiced once they
            reach $25, plus a monthly sweep for whatever is left. Stop by simply
            not rendering; nothing recurs.
          </p>
        </section>

        {/* final CTA */}
        <section className="jsl-final">
          <div className="jsl-eyebrow">Roll credits</div>
          <h2 className="jsl-h2">
            Start for <span className="it">free.</span>
          </h2>
          <p className="jsl-sub" style={{ margin: "0 auto 24px", maxWidth: 520 }}>
            {VATER_TRIAL_CAPS.transcripts} transcripts, {VATER_TRIAL_CAPS.scenes}{" "}
            scene generation and {VATER_TRIAL_CAPS.animations} animation on the
            house — no card, no clock. Add a card when you are ready to finish a
            full video.
          </p>
          <a className="jsl-btn jsl-btn-amber" href={SIGNUP}>Open the studio</a>
        </section>

        <footer className="jsl-foot">
          <span>JELLY·STUDIO — A TOLLEY.IO PRODUCT</span>
          <span>KANSAS CITY, MO</span>
        </footer>
      </div>
    </div>
  );
}
