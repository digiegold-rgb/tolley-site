'use client';

/**
 * PricingCalculator — three sliders and one honest number.
 *
 * Jelly has no plans, so the question "what will this cost me?" has no answer
 * on a price card. It has an answer per video, and the only way to show that
 * before someone signs up is to let them describe their month: how many
 * videos, how long, how much of it animated.
 *
 * RULES THIS COMPONENT FOLLOWS
 *  1. Dollars, not formulas. The headline is "≈ $X per video · $Y per month".
 *     The arithmetic lives behind a "how is this computed?" expander for the
 *     people who want it, and nowhere else.
 *  2. Every rate is fetched, never hardcoded — GET /api/vater/billing/rate
 *     serves the same ops rate the invoice charges (env
 *     VATER_OPS_RATE_PER_MIN) and the same measured per-minute compute the
 *     estimate API quotes. A calculator that goes stale when Jared changes
 *     the rate is worse than no calculator.
 *  3. The comparison line is one named product, its published price, and a
 *     date. No claims about anyone's quality or conduct.
 *  4. It is an estimate and it says so. A real project gets a real quote from
 *     GET /api/vater/youtube/[id]/estimate before anything renders.
 *
 * TWO HOSTS, ONE COMPONENT. It renders on the public landing page (which takes
 * the CINEMA_PALETTE default below) and on the in-app Billing screen (which
 * passes its live theme slice through `palette`). It therefore uses NO
 * class names and NO useTheme() — the studio's palette can be light, and the
 * landing has no ThemeProvider above it. Every colour arrives as a prop.
 * JELLY_TOKENS is imported for the token VALUES only, never for a theme hook.
 */

import * as React from 'react';

import { planEstimate } from '@/lib/vater/billing/estimate';
import { usePricingRates } from '@/lib/vater/use-estimate';
import { BETA_MAX_SECONDS } from '@/lib/vater/script-limits';
import { JELLY_TOKENS } from '../tokens';

/** Public beta length: default 5:00, hard cap 9:00. Do not quote a 20-minute
 *  video the beta cannot render. */
const BETA_MAX_MINUTES = Math.round(BETA_MAX_SECONDS / 60);
const BETA_DEFAULT_MINUTES = 5;

/* ── the one competitor line ───────────────────────────────────────────────
 * Published subscription price, read off the vendor's own pricing page on the
 * date below. Re-check it before any deploy that changes this file. */
const COMPARISON = {
  name: 'TubeGen Starter',
  monthlyUsd: 149,
  checkedOn: '16 August 2026',
} as const;

export interface CalculatorPalette {
  surface: string;
  surfaceAlt: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
}

/**
 * The cinema palette — the landing default, and the one to pass from any
 * other dark public surface. Literal token values (not var() names) so the
 * calculator is correct wherever it is mounted, including outside `.jsl`.
 * `surface` is the glass fill; `surfaceAlt` is the deep panel the answer sits
 * on. Violet is the accent, which is what tints the sliders.
 */
export const CINEMA_PALETTE: CalculatorPalette = {
  surface: JELLY_TOKENS.dark.card, // rgba(240,238,248,0.04)
  surfaceAlt: JELLY_TOKENS.dark.cardAlt, // #08070F
  text: JELLY_TOKENS.dark.text, // #F0EEF8
  textSecondary: JELLY_TOKENS.dark.textSecondary, // #9A94B0
  border: 'rgba(240,238,248,0.12)',
  accent: JELLY_TOKENS.brand, // #8F7DFF
};

export interface PricingCalculatorProps {
  /** Colours for the host surface. Omit for the public landing page. */
  palette?: CalculatorPalette;
  /** Heading text. Omit to render without one (the host provides it). */
  title?: string | null;
  /** Font stack; the studio passes its own. */
  fontFamily?: string;
}

const usd = (n: number): string =>
  n >= 100 ? `$${Math.round(n).toLocaleString()}` : `$${n.toFixed(2)}`;

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Rendered to the right of the label — "12 videos", "6 min", "40%". */
  readout: string;
  accent: string;
  text: string;
  textSecondary: string;
  onChange: (v: number) => void;
}

function Slider({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  readout,
  accent,
  text,
  textSecondary,
  onChange,
}: SliderProps): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          fontSize: 13,
          color: textSecondary,
        }}
      >
        <span>{label}</span>
        <strong style={{ color: text, fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {readout}
        </strong>
      </label>
      {/* accentColor paints the track fill AND the thumb from one value, which
        * is the only way to tint a native range without a stylesheet — and a
        * stylesheet is off the table because this component has two hosts with
        * two different palettes. */}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
        style={{
          width: '100%',
          accentColor: accent,
          cursor: 'pointer',
          height: 22,
          borderRadius: 999,
          background: 'transparent',
        }}
      />
    </div>
  );
}

export function PricingCalculator({
  palette = CINEMA_PALETTE,
  title = 'Price your month',
  fontFamily = JELLY_TOKENS.font,
}: PricingCalculatorProps): React.ReactElement {
  const [videosPerMonth, setVideosPerMonth] = React.useState(8);
  const [minutesPerVideo, setMinutesPerVideo] = React.useState(BETA_DEFAULT_MINUTES);
  /* Motion starts at 0 on purpose. Still scenes are what the published
   * "$1–7 a video" range on this page was measured on, so the calculator's
   * opening number has to agree with the sentence above it. Motion is the
   * expensive half (roughly six times the compute of a still minute) and the
   * user reveals that by moving the slider, which is the honest order: see the
   * baseline, then see what the upgrade costs. */
  const [motionPct, setMotionPct] = React.useState(0);

  const { rates } = usePricingRates();

  const plan = React.useMemo(
    () =>
      planEstimate({
        videosPerMonth,
        minutesPerVideo,
        motionShare: motionPct / 100,
        opsRatePerMinute: rates.opsRatePerMinute,
      }),
    [videosPerMonth, minutesPerVideo, motionPct, rates.opsRatePerMinute],
  );

  const cheaper = COMPARISON.monthlyUsd - plan.perMonthUsd;

  return (
    <div
      data-testid="pricing-calculator"
      style={{
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        borderRadius: JELLY_TOKENS.radius.xl,
        padding: '24px 22px',
        color: palette.text,
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        /* Glass. Harmless on an opaque studio surface (there is nothing behind
         * it to blur), correct on the landing's translucent one. */
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {title ? (
        <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {title}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Slider
          id="jcalc-videos"
          label="Videos a month"
          value={videosPerMonth}
          min={1}
          max={60}
          readout={`${videosPerMonth}`}
          accent={palette.accent}
          text={palette.text}
          textSecondary={palette.textSecondary}
          onChange={setVideosPerMonth}
        />
        <Slider
          id="jcalc-minutes"
          label="Minutes per video"
          value={minutesPerVideo}
          min={1}
          max={BETA_MAX_MINUTES}
          readout={`${minutesPerVideo} min`}
          accent={palette.accent}
          text={palette.text}
          textSecondary={palette.textSecondary}
          onChange={setMinutesPerVideo}
        />
        <div style={{ fontSize: 12, color: palette.textSecondary, marginTop: -10 }}>
          Beta videos default to 5:00 and cap at 9:00.
        </div>
        <Slider
          id="jcalc-motion"
          label="Scenes with motion"
          value={motionPct}
          min={0}
          max={100}
          step={5}
          readout={`${motionPct}%`}
          accent={palette.accent}
          text={palette.text}
          textSecondary={palette.textSecondary}
          onChange={setMotionPct}
        />
        <div style={{ fontSize: 12, color: palette.textSecondary, marginTop: -6 }}>
          Still scenes get a slow camera move. Animated scenes run a second
          model over them — that pass is most of the cost of a video, so this
          slider moves the number more than the other two.
        </div>
      </div>

      {/* the answer */}
      <div
        style={{
          background: palette.surfaceAlt,
          border: `1px solid ${palette.border}`,
          borderRadius: JELLY_TOKENS.radius.lg,
          padding: '18px 20px',
        }}
      >
        <div
          data-testid="pricing-calculator-total"
          style={{
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
            color: palette.accent,
          }}
        >
          ≈ {usd(plan.perVideoUsd)}{' '}
          <span style={{ color: palette.text, fontSize: 15, fontWeight: 500 }}>
            per video
          </span>
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {usd(plan.perMonthUsd)}{' '}
          <span style={{ color: palette.textSecondary, fontSize: 14, fontWeight: 400 }}>
            a month, for {videosPerMonth} {videosPerMonth === 1 ? 'video' : 'videos'}
          </span>
        </div>

        {/* One named product, its published price, and the date it was read. */}
        <div
          style={{
            fontSize: 12,
            color: palette.textSecondary,
            marginTop: 12,
            lineHeight: 1.6,
          }}
        >
          {cheaper > 0
            ? `That is ${usd(cheaper)} a month less than ${COMPARISON.name}, published at $${COMPARISON.monthlyUsd}/mo (checked ${COMPARISON.checkedOn}) — and you pay it only in the months you render.`
            : `${COMPARISON.name} is published at $${COMPARISON.monthlyUsd}/mo (checked ${COMPARISON.checkedOn}), charged whether you render or not.`}
        </div>
      </div>

      <details style={{ fontSize: 13, color: palette.textSecondary }}>
        <summary style={{ cursor: 'pointer', color: palette.text }}>
          How is this computed?
        </summary>
        <div style={{ marginTop: 10, lineHeight: 1.7 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>GPU time for still scenes, at what it costs us</span>
            <strong style={{ color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
              {usd(plan.breakdown.stills)}
            </strong>
          </div>
          {plan.breakdown.motion > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>GPU time for the motion pass, at what it costs us</span>
              <strong style={{ color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
                {usd(plan.breakdown.motion)}
              </strong>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span>Render operations, a flat rate per finished minute</span>
            <strong style={{ color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
              {usd(plan.breakdown.ops)}
            </strong>
          </div>
          <p style={{ margin: '10px 0 0' }}>
            That is one video of {minutesPerVideo}{' '}
            {minutesPerVideo === 1 ? 'minute' : 'minutes'} — about{' '}
            {usd(plan.perMinuteUsd)} a finished minute. There is no
            subscription, no seat fee and no monthly minimum, and credit you buy
            does not expire.
          </p>
          <p style={{ margin: '8px 0 0' }}>
            These are measured averages across recent renders, not a quote.
            Every project gets its own itemised estimate before it renders, and
            an itemised receipt after. Failed renders are never charged.
          </p>
        </div>
      </details>
    </div>
  );
}

export default PricingCalculator;
