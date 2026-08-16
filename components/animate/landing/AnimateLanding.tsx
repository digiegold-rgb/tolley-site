/**
 * Public marketing landing for /animate — shown to signed-out visitors
 * (signed-in users get the studio Shell).
 *
 * ── THE CINEMA PASS, 2026-08-16 ──────────────────────────────────────────
 * Rebuilt from design/jelly-cinema-2026-08-16/ ("Jelly Studio Landing Space").
 * Dark #0A0A14 stage, projector beam, glass panels on violet/cyan, Space
 * Grotesk with Instrument Serif italic reserved for the cinematic beats. The
 * page is structured as a picture: nav → hero → marquee → Act I (the story) →
 * Act II (the making) → Act III (the box office) → Act IV (the price of
 * admission) → intermission (the competition) → billing → FAQ → roll credits.
 *
 * The pink "1C" brand system that was here before is GONE. If you find a pink
 * value, an --ink custom property or a .jsl-* component class anywhere under
 * landing/, it is a leftover from that pass and should be removed, not copied.
 * Colours come from JELLY_TOKENS (components/animate/tokens.ts) via inline
 * styles — the same source the studio reads — and landing.css now holds only
 * what inline styles cannot express (media queries, :focus, ::placeholder).
 *
 * This is a SERVER component. It reads the ops rate and computes every
 * estimate server-side and hands finished numbers to three small client
 * islands (StoryChips, CancelSubscriptionButton, InviteRequestForm) plus the
 * shared cinema primitives. Do not add 'use client' to it.
 *
 * ── THE CONTRACT (unchanged since 2026-08-15, extended for the cinema pass)
 *
 *   1. Every number is real, and every "$" on this page traces to a source:
 *        · demo costs        → lib/vater/demo-videos.ts (reconciled all-in)
 *        · the ticket rows   → that demo's `receipt` (its costJson breakdown)
 *        · story-chip prices → localEstimate() at the live getOpsRate()
 *        · $0.35 / minute    → getOpsRate()
 *        · credit packs      → creditPackOptions() (what Stripe charges)
 *        · "$1–7 all in"     → the measured range in the header contract
 *        · "$10 starter credit" → the promotional credit granted on signup
 *      Nothing on this page is typed by hand as a dollar figure.
 *   2. No demo plays until its subject has signed showcase consent — the page
 *      maps over LIVE_DEMOS, never DEMO_VIDEOS.
 *   3. No invented frames. The two back cards in the hero stack show a real
 *      frame of the demo render or an honest "awaiting sign-off" slate; they
 *      never show a picture from a film that does not exist.
 *   4. Competitor figures are date-stamped, sourced from public pricing pages,
 *      and stated as prices and published limits only. No claims about
 *      anyone's quality, conduct or business.
 */

import { HELP_FAQ, HELP_SUPPORT_EMAIL } from "@/lib/vater/help-content";
import { APP_VERSION } from "@/lib/vater/changelog";
import { creditPackOptions } from "@/lib/vater/credit-packs";
import { getOpsRate } from "@/lib/vater/billing/ops-fee";
import { localEstimate, MOTION_USD_PER_MIN } from "@/lib/vater/billing/estimate";
import {
  LIVE_DEMOS,
  demoPerMinute,
} from "@/lib/vater/demo-videos";

import { JELLY_TOKENS, glass } from "../tokens";
import {
  AdmitOneTicket,
  CinemaRoot,
  FilmFrame,
  FILM_MEDIA_STYLE,
  GlassCard,
  GradientText,
  Marquee,
  MicroLabel,
  PillButton,
  ReelSpinner,
  type TicketRow,
} from "../cinema";
import { InviteRequestForm } from "./InviteRequestForm";
import { CancelSubscriptionButton } from "./CancelSubscriptionButton";
import { StoryChips, type StoryChip } from "./StoryChips";
import { CINEMA_PALETTE, PricingCalculator } from "./PricingCalculator";
import "./landing.css";

const t = JELLY_TOKENS.dark;

const INVITE = "#beta";
const SIGNUP = "/signup?callbackUrl=%2Fanimate";
const SIGNIN = "/login?callbackUrl=%2Fanimate";

/* ── prepaid credit packs ──────────────────────────────────────────────
 * Price, credit and fee all come from lib/vater/credit-packs.ts — the same
 * module the Checkout session and the ledger read, so the number printed
 * here cannot drift from the number Stripe charges. Never re-derive them
 * locally; that drift is exactly what this page exists not to do. */
const PACKS = creditPackOptions();
const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const usd = (n: number) => `$${n.toFixed(2)}`;

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
  { name: "Jelly Studio", rate: "$0.55 – $0.95", note: "stills render · no subscription · beta cap 9:00", ours: true },
  { name: "Zebracat", rate: "$0.50 – $1.30", note: "5-minute cap" },
  { name: "StoryShort", rate: "$0.58 – $1.56", note: "" },
  { name: "NoLang", rate: "$0.76 – $1.00", note: "3-minute cap on Standard" },
  { name: "Vidnoz", rate: "$1.33 – $1.80", note: "60-minute cap" },
  { name: "Argil", rate: "$1.49 – $1.56", note: "" },
  { name: "TubeGen", rate: "$1.94 – $2.47", note: "30-minute cap · no free trial · no refunds" },
];

/* ── Act II: the five reels ────────────────────────────────────────────
 * The pipeline, told as reels. Same five stages as PIPELINE_STEPS in
 * lib/vater/help-content.ts (which the in-app Help drawer renders); this is
 * the cinematic wording of the same truth, and both must describe steps a
 * beta user can actually click. */
const REELS = [
  {
    num: "01",
    title: "Script",
    copy: "Paste the story you already wrote, or draft it with help — either way you edit every word before anything is spent.",
  },
  {
    num: "02",
    title: "Voice",
    copy: "Your cloned voice with word-level timing, shaped in a real EQ studio — so it still sounds like you at minute nine.",
  },
  {
    num: "03",
    title: "Scenes",
    copy: "Every beat becomes its own generated cinematic frame — your characters, one locked art style, zero stock footage.",
  },
  {
    num: "04",
    title: "Motion",
    copy: "Animate only the shots that earn it. Per scene, priced before you click, off by default.",
  },
  {
    num: "05",
    title: "Premiere",
    copy: "Captions, soundtrack, compose. Publish to YouTube from the studio or download the MP4 — no watermark, ever.",
  },
] as const;

const MARQUEE = [
  "NOW SHOWING",
  "NO SUBSCRIPTION",
  "NO WATERMARK",
  "YOUR VOICE, CLONED",
  "NO STOCK FOOTAGE, EVER",
  "FAILED RENDERS $0.00",
] as const;

/* ── Act I: the eight stories ──────────────────────────────────────────
 * Chip 0 is the real finished render on this page. Chips 1–7 are pictures
 * nobody has made yet, so they carry a planned runtime and NOTHING else — the
 * price is computed below by localEstimate() at the live ops rate rather than
 * written down, so a change to the rate moves them and a stale hardcoded
 * number can never survive here. `minutes` is the only invented input, and it
 * is stated as an estimate wherever it is shown. */
const STORY_SEEDS: readonly { label: string; line: string; minutes?: number }[] = [
  { label: "My money story", line: "The Quiet Exit — how I finally stopped living for payday." },
  { label: "The year everything changed", line: "Twelve Months — the year that split my life into before and after.", minutes: 3.5 },
  { label: "Our family history", line: "The Kitchen Table — four generations, one recipe, every argument.", minutes: 5 },
  { label: "Grief & what came after", line: "What She Left — the things I only understood once she was gone.", minutes: 4 },
  { label: "The comeback", line: "Round Two — losing everything was the easy part.", minutes: 4.5 },
  { label: "How we met", line: "Aisle Nine — a love story that started over spilled coffee beans.", minutes: 3 },
  { label: "Lessons from my father", line: "His Hands — everything my father taught me without saying a word.", minutes: 4.5 },
  { label: "Starting over at 40", line: "Second Act — the reinvention nobody saw coming, including me.", minutes: 6 },
];

/* ── shared type ───────────────────────────────────────────────────────── */
const H2: React.CSSProperties = {
  fontWeight: 600,
  fontSize: "clamp(34px, 4vw, 52px)",
  letterSpacing: "-0.02em",
  lineHeight: 1.08,
  margin: "0 0 16px",
};
const LEAD: React.CSSProperties = {
  color: t.textSecondary,
  fontSize: 16,
  lineHeight: 1.7,
  margin: 0,
};
const SECTION: React.CSSProperties = { paddingTop: 20, paddingBottom: 110 };
/* MicroLabel defaults to nowrap, which is right for a ticket header and wrong
 * for "ACT IV — THE PRICE OF ADMISSION" on a 390px screen. */
const ACT_LABEL: React.CSSProperties = { marginBottom: 14, whiteSpace: "normal" };

export function AnimateLanding(): React.ReactElement {
  const featured = LIVE_DEMOS[0];
  const opsRate = getOpsRate();
  const opsRateLabel = usd(opsRate);

  /** The render-ops half of the bill for a finished video of this length. */
  const opsFee = (durationSec: number) => (durationSec / 60) * opsRate;

  /* Story-chip prices: stills only (that is what the demos and the published
   * $1–7 range are), at the live ops rate. draftUsd is the stills number;
   * fullUsd would quote a motion pass nobody asked for. */
  const chips: StoryChip[] = STORY_SEEDS.map((s, i) => {
    if (i === 0) {
      return {
        label: s.label,
        line: s.line,
        priceUsd: featured ? featured.allInUsd : 0,
        real: true,
      };
    }
    return {
      label: s.label,
      line: s.line,
      priceUsd: localEstimate({
        minutes: s.minutes ?? 0,
        opsRatePerMinute: opsRate,
      }).draftUsd,
    };
  });

  /* The ADMIT ONE meter's rows. Reconciled truth when the demo carries a
   * receipt; otherwise the only two lines that can be derived without
   * inventing a split. */
  const receipt = featured?.receipt;
  const ticketRows: TicketRow[] = featured
    ? receipt
      ? [
          ...receipt.stages.map((s) => ({ key: s.key, label: s.label, usd: s.usd })),
          {
            key: "ops",
            label: "render ops",
            detail: `${receipt.minutes.toFixed(1)} min × ${usd(receipt.opsRate)}`,
            usd: receipt.opsUsd,
          },
        ]
      : [
          {
            key: "compute",
            label: "compute at cost",
            usd: featured.allInUsd - opsFee(featured.durationSec),
          },
          {
            key: "ops",
            label: "render ops",
            detail: `${(featured.durationSec / 60).toFixed(1)} min × ${opsRateLabel}`,
            usd: opsFee(featured.durationSec),
          },
        ]
    : [];

  /* "The Quiet Exit — My Money Mindset" is the library title; the marquee name
   * is its first clause. Derived, not retyped, so a library rename follows. */
  const shortTitle = featured ? featured.title.split(" — ")[0] : "";

  return (
    <CinemaRoot className="jsl" beam density="full">
      {/* ══ nav ══════════════════════════════════════════════════════════ */}
      <nav
        className="jsl-band"
        style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 22, paddingBottom: 22 }}
      >
        <a href="/animate" style={{ display: "flex", alignItems: "center", gap: 14, textDecoration: "none", color: t.text }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/animate/brand/logo.svg"
            alt="Jelly Studio"
            width={34}
            height={34}
            style={{ width: 34, height: 34, filter: "drop-shadow(0 0 14px rgba(143,125,255,0.6))" }}
          />
          <span className="jsl-wordmark" style={{ fontWeight: 700, letterSpacing: "0.12em", fontSize: 14, whiteSpace: "nowrap" }}>
            JELLY STUDIO
          </span>
        </a>
        <span
          className="jsl-verpill"
          style={{
            fontSize: 11,
            color: t.textFaint,
            letterSpacing: "0.06em",
            padding: "4px 10px",
            border: `1px solid rgba(240,238,248,0.12)`,
            borderRadius: JELLY_TOKENS.radius.pill,
            whiteSpace: "nowrap",
          }}
        >
          v{APP_VERSION} · public beta
        </span>
        <div style={{ flex: 1 }} />
        <div className="jsl-navlinks">
          <a className="jc-nav-link jsl-navlink" href="#stories">Stories</a>
          <a className="jc-nav-link jsl-navlink" href="#reels">The reels</a>
          <a className="jc-nav-link jsl-navlink" href="#boxoffice">Box office</a>
          <a className="jc-nav-link jsl-navlink" href={SIGNIN}>Sign in</a>
          <PillButton variant="gradient" size="md" href={INVITE}>Request an invite</PillButton>
        </div>
      </nav>

      {/* ══ hero ═════════════════════════════════════════════════════════ */}
      <header className="jsl-band jsl-hero">
        <div>
          <div
            className="jc-fadein jsl-eyebrow-pill"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              color: JELLY_TOKENS.brandLight,
              border: `1px solid ${JELLY_TOKENS.brandOutline}`,
              background: JELLY_TOKENS.brandGhost,
              padding: "8px 18px",
              borderRadius: JELLY_TOKENS.radius.pill,
              marginBottom: 26,
            }}
          >
            ✦ FEATURE PRESENTATION · NO SUBSCRIPTION ✦
          </div>
          <h1
            className="jc-rise-load jc-d1"
            style={{
              fontWeight: 600,
              fontSize: "clamp(46px, 5.4vw, 74px)",
              lineHeight: 1.03,
              letterSpacing: "-0.03em",
              margin: "0 0 22px",
            }}
          >
            Your life is already <GradientText serif>a motion picture.</GradientText>
            <br />
            We just develop the film.
          </h1>
          <p
            className="jc-rise-load jc-d2"
            style={{ ...LEAD, fontSize: 17, maxWidth: 500, margin: "0 0 32px" }}
          >
            Write the story only you can tell — your money, your family, the year
            everything changed. Jelly turns it into a finished cinematic film:
            your cloned voice, a generated scene for every line, no stock
            footage, no watermark. You pay per picture, never per month. Most
            films: <strong style={{ color: t.text }}>$1–7 all in.</strong>
          </p>
          <div className="jc-rise-load jc-d3" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <PillButton variant="gradient" size="lg" href={SIGNUP}>Roll camera</PillButton>
            <PillButton variant="ghost" size="lg" href="#stories">Pick a story ↓</PillButton>
          </div>
          <div className="jc-rise-load jc-d4" style={{ fontSize: 12, color: t.textFaint, marginTop: 18 }}>
            $10 starter credit on signup · nothing charged until you spend it
          </div>
        </div>

        {/* The floating stack — three REAL Jelly renders: front = The Quiet Exit
          * (demo #23), mid = Digital Gold Diggers reel, back = the Lady. Never a
          * picture from a film that does not exist. */}
        <div className="jsl-filmstage">
          <div className="jsl-filmstack">
            {/* back — the Lady (persona character from the shorts lane; frame
              * from her locked character reference, a real render). */}
            <div
              className="jc-floatC"
              style={{
                position: "absolute",
                left: "10%",
                right: 0,
                top: 0,
                height: 225,
                borderRadius: JELLY_TOKENS.radius.lg,
                overflow: "hidden",
                border: `1px solid ${t.border}`,
                boxShadow: t.cardShadow,
                background: t.cardAlt,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/animate/brand/poster-lady-1280x720.jpg" alt="The Lady — a Jelly Studio character" style={FILM_MEDIA_STYLE} />
            </div>

            {/* mid — Digital Gold Diggers, the 30s demo reel (a real render;
              * poster-dgd-30s-1280x720.jpg is a frame grab of it). */}
            <div
              className="jc-floatB"
              style={{
                position: "absolute",
                left: "5%",
                right: "5%",
                top: 64,
                height: 225,
                borderRadius: JELLY_TOKENS.radius.lg,
                overflow: "hidden",
                border: `1px solid ${t.borderStrong}`,
                boxShadow: "0 40px 80px rgba(0,0,0,0.55)",
                background: t.cardAlt,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/animate/brand/poster-dgd-30s-1280x720.jpg" alt="Digital Gold Diggers — demo reel" style={FILM_MEDIA_STYLE} />
            </div>

            {/* front — the film itself */}
            {featured ? (
              <FilmFrame
                glow
                className="jc-floatA"
                style={{ position: "absolute", left: 0, right: "10%", top: 150, height: 300 }}
                overlay={
                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      right: 10,
                      bottom: 10,
                      pointerEvents: "none",
                      background: "rgba(10,10,20,0.75)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: `1px solid rgba(240,238,248,0.12)`,
                      borderRadius: JELLY_TOKENS.radius.sm,
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{shortTitle}</div>
                      <div style={{ fontSize: 10.5, color: t.textSecondary }}>
                        a film about one payday · {featured.duration}
                      </div>
                    </div>
                    <div className="jc-tabular" style={{ fontWeight: 700, fontSize: 14, color: JELLY_TOKENS.cyan, whiteSpace: "nowrap" }}>
                      {usd(featured.allInUsd)}
                    </div>
                  </div>
                }
              >
                <video
                  src={featured.url}
                  poster={featured.poster}
                  preload="none"
                  controls
                  playsInline
                  aria-label={`Demo video: ${featured.title}`}
                  style={FILM_MEDIA_STYLE}
                />
              </FilmFrame>
            ) : null}
          </div>
        </div>
      </header>

      <Marquee items={MARQUEE} />

      {/* ══ Act I — the story ════════════════════════════════════════════ */}
      <section id="stories" className="jsl-band" style={{ paddingTop: 100, paddingBottom: 100, textAlign: "center" }}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>ACT I — THE STORY</MicroLabel>
          <h2 style={{ ...H2, margin: "0 0 12px" }}>What picture will you make first?</h2>
          <p style={{ ...LEAD, margin: "0 0 36px" }}>
            Not niches. Not trends. The stuff of an actual life. Tap one.
          </p>
          <StoryChips chips={chips} />
        </div>
      </section>

      {/* ══ Act II — the making ══════════════════════════════════════════ */}
      <section id="reels" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>ACT II — THE MAKING</MicroLabel>
          <h2 style={{ ...H2, maxWidth: 640, margin: "0 0 40px" }}>
            Five reels.
            <br />
            You hold the pen the whole way.
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
            {REELS.map((r) => (
              <GlassCard key={r.num} hover radius={JELLY_TOKENS.radius.xl} padding="26px 22px" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <ReelSpinner />
                  <MicroLabel tone="violet" size={11} tracking="0.22em">REEL {r.num}</MicroLabel>
                </div>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{r.title}</div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: t.textSecondary }}>{r.copy}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Act III — the box office ═════════════════════════════════════ */}
      <section id="boxoffice" className="jsl-band jsl-boxoffice" style={{ paddingBottom: 110 }}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>ACT III — THE BOX OFFICE</MicroLabel>
          <h2 style={H2}>
            One ticket. One film.
            <br />
            No season pass.
          </h2>
          <p style={{ ...LEAD, maxWidth: 460, margin: "0 0 26px" }}>
            Every render prints an itemised receipt while it runs — GPU time at
            our cost plus a flat {opsRateLabel} per finished minute. Failed
            renders are never charged. Credit never expires. And there is no
            subscription, which makes this button decorative:
          </p>
          <CancelSubscriptionButton />
        </div>
        <div className="jc-rise">
          {featured ? (
            <AdmitOneTicket
              live
              size="hero"
              label="ADMIT ONE — LIVE METER"
              state="NOW FILMING"
              doneState="FADE TO BLACK — MP4 READY"
              totalUsd={featured.allInUsd}
              rows={ticketRows}
              data-testid="boxoffice-ticket"
              footer={
                <>
                  “{shortTitle}” · {featured.duration} · a real render, a real
                  receipt · overruns capped, we absorb the rest
                </>
              }
            />
          ) : null}
        </div>
      </section>

      {/* ══ Act IV — the price of admission ══════════════════════════════ */}
      <section id="pricing" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>ACT IV — THE PRICE OF ADMISSION</MicroLabel>
          <h2 style={{ ...H2, maxWidth: 720 }}>
            The most affordable way to make faceless videos.
            <br />
            <GradientText serif>Pay only for what you render.</GradientText>
          </h2>

          <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="30px 28px" style={{ marginTop: 28 }}>
            <div className="jc-tabular" style={{ fontSize: "clamp(48px, 7vw, 76px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1 }}>
              $1–7
            </div>
            <div style={{ fontSize: 13.5, color: t.textFaint, marginTop: 10 }}>
              per finished long-form video of stills · motion priced separately ·
              no subscription
            </div>
            <ul style={{ listStyle: "none", margin: "26px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                <>
                  A typical long-form video runs <strong style={{ color: t.text }}>$1 to $7 all in</strong>.
                  Our {BENCHMARK.length} benchmark render cost {BENCHMARK.allIn}.
                  Both of those are stills renders, which is what the film on
                  this page is; generated motion adds about {usd(MOTION_USD_PER_MIN)}{" "}
                  per animated minute on top, and the calculator below quotes it
                  before you spend anything.
                </>,
                <>
                  Every render shows you an itemised receipt: GPU time at our
                  cost ({COMPUTE_RANGE} per finished minute across recent
                  renders) plus a flat {opsRateLabel} per finished minute. No
                  markup games, no monthly bill, no expiring quota.
                </>,
                <>Failed renders are never charged. Not partially, not at all.</>,
                <>
                  If a render overruns its estimate on repair passes, your bill
                  is capped at the estimate and we absorb the rest.
                </>,
                <>
                  No subscription, no seat fee, no monthly minimum. Credit you
                  buy does not expire.
                </>,
                <>
                  Beta maximum length is {BETA_MAX_MINUTES}. It is proven clean
                  to just under nine minutes; longer is coming.
                </>,
              ].map((node, i) => (
                <li key={i} style={{ display: "flex", gap: 12, ...LEAD, fontSize: 15.5 }}>
                  <span aria-hidden="true" style={{ color: JELLY_TOKENS.brandLight, flex: "none" }}>—</span>
                  <span>{node}</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          {/* Three sliders → "≈ $X per video · $Y per month". Client island; it
            * fetches the live ops rate rather than being handed this page's
            * server-side copy, so the two can never disagree. */}
          <div style={{ marginTop: 24 }}>
            <PricingCalculator palette={CINEMA_PALETTE} title="Price your month" />
          </div>

          {/* prepaid packs, as tickets, with the Stripe fee shown not buried */}
          <MicroLabel tone="faint" size={10.5} tracking="0.3em" style={{ margin: "44px 0 14px", whiteSpace: "normal" }}>
            — PREPAID CREDIT PACKS —
          </MicroLabel>
          <p style={{ ...LEAD, maxWidth: 640, marginBottom: 20 }}>
            You buy credit up front and spend it a render at a time. A $10 pack
            is {dollars(PACKS[0].creditsCents)} of credit — the difference is
            Stripe&rsquo;s card processing fee, and we do not add anything on
            top of it. We would rather print that than round the price to $10.61
            and hide it.
          </p>
          <div className="jsl-packs">
            {PACKS.map((p) => (
              <AdmitOneTicket
                key={p.pack}
                size="card"
                label="ADMIT ONE — CREDIT PACK"
                totalUsd={p.priceCents / 100}
                notes={[
                  { label: "credit", value: dollars(p.creditsCents), tone: "cyan" },
                  { label: "Stripe fee", value: dollars(p.feeCents), tone: "faint" },
                ]}
                action={
                  <PillButton variant="gradient" size="sm" href={SIGNUP}>
                    Buy {dollars(p.priceCents)}
                  </PillButton>
                }
              />
            ))}
          </div>

          {featured ? (
            <p style={{ ...LEAD, fontSize: 13, color: t.textFaint, maxWidth: 720, marginTop: 22 }}>
              The meter in Act III is the receipt from the film at the top of
              this page — {usd(featured.allInUsd)} all in, {demoPerMinute(featured)} —
              not a quote for yours. The render-ops half is fixed at{" "}
              {opsRateLabel} a finished minute; the compute half depends on what
              your scenes actually take to make. The studio shows you that
              receipt while the render is still running, not a month later.
            </p>
          ) : null}
        </div>
      </section>

      {/* ══ intermission — the competition ═══════════════════════════════ */}
      <section id="compare" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>INTERMISSION — THE COMPETITION</MicroLabel>
          <h2 style={{ ...H2, marginBottom: 28 }}>
            What the rest of the shelf <GradientText serif>charges.</GradientText>
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
          <p style={{ ...LEAD, fontSize: 13, color: t.textFaint, marginTop: 18 }}>
            Figures read off each vendor&rsquo;s public pricing page on{" "}
            {COMPARISON_DATE}, converted to dollars per finished minute.
            Subscription rates assume 100% of the monthly quota is used — leave
            any of it unused and the real rate is higher. Plans change; check
            before you buy. Our own range is measured across recent long-form
            renders, all in — those are stills renders, and a video with
            generated motion over its scenes costs more per minute than the row
            above. The calculator higher up the page prices both.
          </p>
        </div>
      </section>

      {/* ══ billing, plainly ═════════════════════════════════════════════ */}
      <section id="how-billing-works" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>THE SMALL PRINT — BILLING</MicroLabel>
          <h2 style={{ ...H2, marginBottom: 24 }}>
            You are never billed for a <GradientText serif>month.</GradientText>
          </h2>
          <GlassCard radius={JELLY_TOKENS.radius.xxl} padding="30px 28px">
            <p style={{ ...LEAD, fontSize: 16.5, maxWidth: 720 }}>
              Put a card on file and Stripe places a $0 verification hold —
              nothing is charged. A $10 promotional starter credit lands on your
              balance, and it covers the stills pipeline: scripts, transcripts,
              voice and still scenes. Animated motion runs on purchased credit
              only, so a fully animated video means topping up first — we would
              rather say that here than let you find it at the render button.
              Top up with a pack whenever you want to; there is no minimum and
              no renewal date. Every render draws down the balance by its own
              itemised cost, and the receipt shows compute, ops and wall-clock
              time. Stop by not rendering — there is nothing to cancel.
            </p>
          </GlassCard>
        </div>
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════════ */}
      <section id="faq" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>THE SMALL PRINT — QUESTIONS</MicroLabel>
          <h2 style={{ ...H2, marginBottom: 28 }}>
            The fine print, <GradientText serif>unfined.</GradientText>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {HELP_FAQ.map((f) => (
              <details
                key={f.q}
                className="jc-details jsl-faq-row"
                style={{ ...glass(t), borderRadius: JELLY_TOKENS.radius.lg, padding: "16px 20px" }}
              >
                <summary style={{ fontSize: 16, fontWeight: 500, color: t.text }}>{f.q}</summary>
                <div style={{ marginTop: 12, fontSize: 15, lineHeight: 1.7, color: t.textSecondary }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ about the beta ═══════════════════════════════════════════════ */}
      <section id="about-the-beta" className="jsl-band" style={SECTION}>
        <div className="jc-rise">
          <MicroLabel tone="cyan" style={ACT_LABEL}>THE SMALL PRINT — THE BETA</MicroLabel>
          <h2 style={{ ...H2, marginBottom: 20 }}>
            Small on purpose, <GradientText serif>documented</GradientText> in public.
          </h2>
          <p style={{ ...LEAD, maxWidth: 660, marginBottom: 22 }}>
            Jelly Studio is invite-only while the render fleet is small enough
            that everyone gets the whole machine. Every build is dated in the
            changelog — this is v{APP_VERSION} — and the feedback box inside the
            studio files a real ticket that a person reads.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 14 }}>
            <a className="jc-link" href="/animate/beta">Beta program terms</a>
            <a className="jc-link" href="/animate/terms">Terms of service</a>
            <a className="jc-link" href="/animate/privacy">Privacy</a>
            <a className="jc-link" href={`mailto:${HELP_SUPPORT_EMAIL}`}>{HELP_SUPPORT_EMAIL}</a>
          </div>
        </div>
      </section>

      {/* ══ roll credits ═════════════════════════════════════════════════ */}
      <section className="jsl-band" style={{ maxWidth: 820, paddingTop: 40, paddingBottom: 40, textAlign: "center" }}>
        <div className="jc-rise">
          <MicroLabel tone="faint" size={10.5} tracking="0.3em" style={{ marginBottom: 18 }}>
            — ROLL CREDITS —
          </MicroLabel>
          <GradientText serif as="h2" style={{ fontSize: "clamp(44px, 6vw, 76px)", margin: "0 0 18px", lineHeight: 1.1 }}>
            Directed by you.
          </GradientText>
          <p style={{ ...LEAD, fontSize: 16.5, maxWidth: 520, margin: "0 auto 32px" }}>
            Invite-only while the render fleet is small enough that everyone gets
            the whole machine. A $10 starter credit is waiting behind the card
            form — nothing is charged until you spend it.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <PillButton variant="gradient" size="lg" href={INVITE}>Request an invite</PillButton>
            <PillButton variant="ghost" size="lg" href={SIGNIN}>Have a code? Sign in</PillButton>
          </div>
        </div>
      </section>

      {/* the form the two "Request an invite" pills point at */}
      <section className="jsl-band" style={{ maxWidth: 820, paddingTop: 20, paddingBottom: 120 }}>
        <GlassCard id="beta" className="jc-rise" radius={JELLY_TOKENS.radius.xxl} padding="30px 28px" halo>
          <MicroLabel tone="violet" size={11} tracking="0.24em" style={{ marginBottom: 12 }}>
            REQUEST AN INVITE
          </MicroLabel>
          <p style={{ ...LEAD, fontSize: 15, marginBottom: 20 }}>
            Tell us what you want to make. Invites go out in small batches, and
            a $10 starter credit — enough to take a script all the way to
            finished still scenes — is waiting on the other side of the card
            form.
          </p>
          <InviteRequestForm />
        </GlassCard>
      </section>

      {/* ══ footer ═══════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: `1px solid ${t.border}`, background: t.headerBg, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
        <div
          className="jsl-band"
          style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", paddingTop: 26, paddingBottom: 26, fontSize: 12, color: t.textFaint }}
        >
          <span style={{ letterSpacing: "0.14em", color: t.textSecondary, fontWeight: 600 }}>JELLY STUDIO</span>
          <span>KANSAS CITY, MO</span>
          <div style={{ flex: 1 }} />
          <a className="jc-nav-link" href="/animate/terms" style={{ color: t.textFaint }}>Terms</a>
          <a className="jc-nav-link" href="/animate/privacy" style={{ color: t.textFaint }}>Privacy</a>
          <a className="jc-nav-link" href="/animate/beta" style={{ color: t.textFaint }}>Beta</a>
          <span>v{APP_VERSION} · public beta</span>
        </div>
      </footer>
    </CinemaRoot>
  );
}

/** The honest stand-in for a film that exists but has not cleared consent.
 *  Never a generated frame — see rule 3 in the header contract. */
