'use client';

/**
 * PathChooser — Step 1 of StylePickerModal.
 *
 * Testers kept missing the own-script lane (it used to be a 12px checkbox,
 * then a pair of equal cards under a gradient wash). Own-script is the one
 * customers come looking for and still walk past, because Jelly-writes is
 * pre-selected and the style grid underneath looks like the next click.
 *
 * So the unselected own-script card is the loud cinema CTA (gradient fill +
 * full-width pill). The selected card is the ink "SELECTED" state. Cards
 * stack once the chooser is too narrow for two readable columns.
 *
 * Radiogroup + data-testid path-own-script / path-jelly-writes are load-bearing
 * for the Fable 5 walkthrough. Do not rename them. "✓ SELECTED" is asserted.
 *
 * 2026-08-27: a third lane, `video`. "Start from a video" used to be folded
 * into own-script, which is why Trey never found it — the two are the same
 * shape to the pipeline but nothing like the same intent to a person. The
 * boolean prop is kept as a derived convenience for callers that only care
 * whether a script is being supplied (`own` and `video` both do).
 */

import * as React from 'react';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon, type IconName } from '../../Icon';
import { GradientText } from '../../cinema';

const INK = '#0A0A14';
const PAPER = '#F0EEF8';

/** Which door the customer came in through. */
export type StartPath = 'own' | 'video' | 'jelly';

/** True when the customer supplies the source material (script or video). */
export function pathSuppliesSource(p: StartPath): boolean {
  return p !== 'jelly';
}

export interface PathChooserProps {
  path: StartPath;
  disabled?: boolean;
  onChange: (p: StartPath) => void;
}

interface PathOption {
  path: StartPath;
  testId: string;
  icon: IconName;
  title: string;
  body: string;
  cta: string;
  next: string;
}

const OPTIONS: PathOption[] = [
  {
    path: 'own',
    testId: 'path-own-script',
    icon: 'edit',
    title: 'I already have my script',
    body: 'Paste it below. Your words are read verbatim — then pick a Style for the voice.',
    cta: 'Paste my script',
    next: '▼ Paste your script below',
  },
  {
    path: 'video',
    testId: 'path-from-video',
    icon: 'web',
    title: 'Start from a video',
    body:
      'Drop in a YouTube link. Keep its words as they are, or have them transcribed and rewritten as your own script — your host, your rules, your length.',
    cta: 'Paste a link',
    next: '▼ Paste the link below',
  },
  {
    path: 'jelly',
    testId: 'path-jelly-writes',
    icon: 'sparkle',
    title: 'Jelly writes the script',
    body:
      'Pick a Style below to open a new project. Jelly writes on the Script step, from your title and notes — nothing is written or charged until you press Generate there.',
    cta: 'Start from a Style',
    next: '▼ Pick a Style below',
  },
];

const PATH_ORDER: StartPath[] = ['own', 'video', 'jelly'];

export function PathChooser({
  path,
  disabled = false,
  onChange,
}: PathChooserProps): React.ReactElement {
  const { t } = useTheme();
  const [hover, setHover] = React.useState<StartPath | null>(null);

  return (
    <div
      role="radiogroup"
      aria-label="How do you want to start?"
      aria-describedby="path-chooser-question"
      onKeyDown={(e) => {
        if (disabled) return;
        if (
          e.key === 'ArrowRight' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowUp'
        ) {
          e.preventDefault();
          const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
          const i = PATH_ORDER.indexOf(path);
          onChange(PATH_ORDER[(i + dir + PATH_ORDER.length) % PATH_ORDER.length]);
        }
      }}
      style={{
        marginBottom: 18,
        padding: 16,
        borderRadius: JELLY_TOKENS.radius.xxl,
        background: JELLY_TOKENS.gradTicket,
        border: `1px solid ${JELLY_TOKENS.brandOutline}`,
        boxShadow: `${JELLY_TOKENS.brandGlow}, 0 0 0 1px ${JELLY_TOKENS.brandOutline}`,
        opacity: disabled ? 0.6 : 1,
        fontFamily: JELLY_TOKENS.font,
      }}
    >
      <div
        style={{
          fontSize: JELLY_TOKENS.micro.size,
          letterSpacing: JELLY_TOKENS.micro.tracking,
          textTransform: 'uppercase',
          fontWeight: 600,
          color: JELLY_TOKENS.cyan,
          marginBottom: 8,
        }}
      >
        Step 1 · How you start — click one
      </div>
      <GradientText
        as="div"
        serif
        style={{
          fontSize: 'clamp(24px, 5vw, 30px)',
          lineHeight: 1.2,
          marginBottom: 6,
        }}
      >
        <span id="path-chooser-question">Where does this video start?</span>
      </GradientText>
      <div
        style={{
          fontSize: 14,
          lineHeight: 1.5,
          color: t.textSecondary,
          marginBottom: 14,
          maxWidth: 640,
        }}
      >
        Click one. Bring a script, bring a video to work from, or let Jelly write it.
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: 12,
        }}
      >
        {OPTIONS.map((opt) => {
          const selected = path === opt.path;
          const hovered = hover === opt.path;
          /* The two bring-your-own lanes are the missable ones. While NOT
             selected they wear the gradient so they read as primary clicks,
             not leftovers beside the pre-selected Jelly card. */
          const magnet = opt.path !== 'jelly' && !selected;
          const plate = magnet
            ? {
                background: JELLY_TOKENS.gradPrimary,
                color: INK,
                border: '3px solid rgba(255,255,255,0.85)',
                boxShadow: hovered
                  ? `${JELLY_TOKENS.brandGlow}, 0 16px 40px rgba(143,125,255,0.45)`
                  : JELLY_TOKENS.brandGlow,
              }
            : selected
              ? {
                  background: INK,
                  color: PAPER,
                  border: `3px solid ${PAPER}`,
                  boxShadow: `0 0 0 4px rgba(143,125,255,0.45), ${JELLY_TOKENS.brandGlow}`,
                }
              : {
                  ...glass(t, { strong: true }),
                  color: t.text,
                  border: `3px solid ${t.borderStrong}`,
                  boxShadow: hovered ? `0 0 0 2px ${JELLY_TOKENS.brandOutline}` : 'none',
                };

          return (
            <button
              key={opt.title}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              data-testid={opt.testId}
              onClick={() => onChange(opt.path)}
              onMouseEnter={() => setHover(opt.path)}
              onMouseLeave={() => setHover(null)}
              style={{
                textAlign: 'left',
                padding: '18px 18px 16px',
                borderRadius: JELLY_TOKENS.radius.lg,
                cursor: disabled ? 'not-allowed' : 'pointer',
                transform: hovered && !disabled ? 'translateY(-2px)' : 'none',
                transition: 'transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                minHeight: 176,
                minWidth: 0,
                fontFamily: JELLY_TOKENS.font,
                ...plate,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span
                  aria-hidden
                  style={{
                    width: 48,
                    height: 48,
                    flexShrink: 0,
                    borderRadius: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: magnet
                      ? INK
                      : selected
                        ? JELLY_TOKENS.gradPrimary
                        : JELLY_TOKENS.brandGhost,
                  }}
                >
                  <Icon
                    name={opt.icon}
                    size={24}
                    color={magnet ? PAPER : selected ? INK : JELLY_TOKENS.brandLight}
                  />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        lineHeight: 1.2,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {opt.title}
                    </span>
                    {selected && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 11,
                          fontWeight: 800,
                          letterSpacing: 0.8,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: JELLY_TOKENS.gradPrimary,
                          color: INK,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ✓ SELECTED
                      </span>
                    )}
                    {magnet && (
                      <span
                        style={{
                          marginLeft: 'auto',
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 0.7,
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: INK,
                          color: PAPER,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        YOUR WORDS
                      </span>
                    )}
                  </span>
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    flexShrink: 0,
                    marginTop: 4,
                    borderRadius: 999,
                    border: magnet
                      ? `2px solid ${INK}`
                      : selected
                        ? '2px solid transparent'
                        : `2px solid ${t.textFaint}`,
                    background: selected ? JELLY_TOKENS.gradPrimary : 'transparent',
                    boxShadow: selected ? `inset 0 0 0 4px ${INK}` : 'none',
                  }}
                />
              </span>

              <span
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  opacity: selected ? 0.92 : magnet ? 0.88 : 0.8,
                }}
              >
                {opt.body}
              </span>

              <span
                style={{
                  marginTop: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  padding: '10px 16px',
                  borderRadius: JELLY_TOKENS.radius.pill,
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                  ...(selected
                    ? {
                        background: 'rgba(240,238,248,0.08)',
                        color: JELLY_TOKENS.cyan,
                        border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                      }
                    : magnet
                      ? {
                          background: INK,
                          color: PAPER,
                          border: '1px solid transparent',
                          boxShadow: '0 8px 20px rgba(10,10,20,0.35)',
                        }
                      : {
                          background: JELLY_TOKENS.brandGhost,
                          color: JELLY_TOKENS.brandLight,
                          border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                        }),
                }}
              >
                {selected ? opt.next : `${opt.cta} →`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
