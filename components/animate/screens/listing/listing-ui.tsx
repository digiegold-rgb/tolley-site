'use client';

/**
 * listing-ui.tsx — the big-type building blocks every wizard step shares.
 *
 * Target user is a 45–70 year old agent on a phone: 18 px body inside the
 * wizard, 22 px+ titles, one clear action per screen, buttons you cannot
 * miss. Everything reads colour from JELLY_TOKENS (which resolve to the
 * `--jb-*` variables the Listing Studio layout sets) so /animate is untouched.
 */
import * as React from 'react';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme } from '../../theme-context';

export const WIZARD_FONT = 18;

export function StepHeader({ step, total = 5, title, lede, testId }: { step: number; total?: number; title: string; lede?: React.ReactNode; testId?: string }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div data-testid={testId} style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase', color: JELLY_TOKENS.brandLight, fontWeight: 600, marginBottom: 6 }}>
        Step {step} of {total}
      </div>
      <h2 style={{ margin: 0, fontSize: 'clamp(26px, 3.4vw, 34px)', lineHeight: 1.15, letterSpacing: '-0.02em', fontWeight: 700, color: t.text }}>{title}</h2>
      {lede && <p style={{ margin: '10px 0 0', fontSize: WIZARD_FONT, lineHeight: 1.55, color: t.textSecondary, maxWidth: 640 }}>{lede}</p>}
    </div>
  );
}

export interface BigButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'outline';
  disabled?: boolean;
  busy?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
  'data-testid'?: string;
  'aria-label'?: string;
  title?: string;
  full?: boolean;
}

export function BigButton({ children, onClick, variant = 'primary', disabled, busy, type = 'button', style, title, full, 'data-testid': testId, 'aria-label': ariaLabel }: BigButtonProps): React.ReactElement {
  const { t } = useTheme();
  const v: Record<NonNullable<BigButtonProps['variant']>, React.CSSProperties> = {
    primary: { background: JELLY_TOKENS.gradPrimary, color: JELLY_TOKENS.onGradient, border: '1px solid transparent', boxShadow: JELLY_TOKENS.brandGlow },
    ghost: { background: 'transparent', color: t.text, border: `1px solid ${t.borderStrong}` },
    outline: { background: JELLY_TOKENS.brandGhost, color: t.text, border: `1px solid ${JELLY_TOKENS.brandOutline}` },
    danger: { background: 'transparent', color: JELLY_TOKENS.error, border: `1px solid ${JELLY_TOKENS.error}` },
  };
  const off = disabled || busy;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={off}
      title={title}
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      data-testid={testId}
      style={{
        ...v[variant],
        fontFamily: JELLY_TOKENS.font,
        fontSize: WIZARD_FONT,
        fontWeight: 700,
        padding: '16px 28px',
        minHeight: 56,
        borderRadius: JELLY_TOKENS.radius.pill,
        cursor: off ? 'not-allowed' : 'pointer',
        opacity: off ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        width: full ? '100%' : undefined,
        transition: 'transform .15s ease, opacity .15s ease',
        ...style,
      }}
    >
      {busy ? 'One moment…' : children}
    </button>
  );
}

export function Field({ label, hint, children, htmlFor, style }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string; style?: React.CSSProperties }): React.ReactElement {
  const { t } = useTheme();
  return (
    <label htmlFor={htmlFor} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: JELLY_TOKENS.font, ...style }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 15, color: t.textFaint, lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

export function inputStyle(t: ReturnType<typeof useTheme>['t'], extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    ...glass(t),
    fontFamily: JELLY_TOKENS.font,
    fontSize: WIZARD_FONT,
    color: t.text,
    padding: '14px 16px',
    minHeight: 54,
    borderRadius: JELLY_TOKENS.radius.md,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    ...extra,
  };
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { 'data-testid'?: string }): React.ReactElement {
  const { t } = useTheme();
  const { style, ...rest } = props;
  return <input {...rest} style={inputStyle(t, style)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { 'data-testid'?: string }): React.ReactElement {
  const { t } = useTheme();
  const { style, children, ...rest } = props;
  return (
    <select {...rest} style={inputStyle(t, { appearance: 'auto', ...style })}>
      {children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { 'data-testid'?: string }): React.ReactElement {
  const { t } = useTheme();
  const { style, ...rest } = props;
  return <textarea {...rest} style={inputStyle(t, { minHeight: 110, resize: 'vertical', lineHeight: 1.5, ...style })} />;
}

export function Chip({ on, children, onClick, tone = 'brand', disabled, testId, title }: { on?: boolean; children: React.ReactNode; onClick?: () => void; tone?: 'brand' | 'warn' | 'block'; disabled?: boolean; testId?: string; title?: string }): React.ReactElement {
  const { t } = useTheme();
  const color = tone === 'warn' ? JELLY_TOKENS.warning : tone === 'block' ? JELLY_TOKENS.error : JELLY_TOKENS.brandLight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={on}
      data-testid={testId}
      style={{
        fontFamily: JELLY_TOKENS.font,
        fontSize: 16,
        fontWeight: on ? 600 : 500,
        padding: '10px 16px',
        minHeight: 44,
        borderRadius: JELLY_TOKENS.radius.pill,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: on ? JELLY_TOKENS.gradChipOn : 'transparent',
        border: `1px solid ${on ? color : t.borderStrong}`,
        color: on ? t.text : t.textSecondary,
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {children}
    </button>
  );
}

export function Notice({ tone = 'info', children, testId, style }: { tone?: 'info' | 'warn' | 'block' | 'ok'; children: React.ReactNode; testId?: string; style?: React.CSSProperties }): React.ReactElement {
  const { t } = useTheme();
  const color = tone === 'warn' ? JELLY_TOKENS.warning : tone === 'block' ? JELLY_TOKENS.error : tone === 'ok' ? JELLY_TOKENS.success : JELLY_TOKENS.brandLight;
  return (
    <div
      role={tone === 'block' ? 'alert' : 'status'}
      data-testid={testId}
      style={{
        borderLeft: `4px solid ${color}`,
        background: t.hover,
        borderRadius: JELLY_TOKENS.radius.md,
        padding: '12px 16px',
        fontSize: 16,
        lineHeight: 1.5,
        color: t.text,
        fontFamily: JELLY_TOKENS.font,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Selectable option tile: title + blurb + optional price/badge, keyboard friendly. */
export function OptionCard({ on, title, blurb, price, badge, disabled, onClick, testId, children }: { on?: boolean; title: string; blurb?: React.ReactNode; price?: string; badge?: React.ReactNode; disabled?: boolean; onClick?: () => void; testId?: string; children?: React.ReactNode }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      role="radio"
      aria-checked={!!on}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      data-testid={testId}
      onClick={() => !disabled && onClick?.()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        ...glass(t),
        borderRadius: JELLY_TOKENS.radius.xl,
        padding: 18,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        border: `2px solid ${on ? JELLY_TOKENS.brand : t.border}`,
        boxShadow: on ? JELLY_TOKENS.brandGlow : undefined,
        fontFamily: JELLY_TOKENS.font,
        color: t.text,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 110,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>{title}</div>
        {price && <div className="jc-tabular" style={{ fontSize: 19, fontWeight: 700, color: JELLY_TOKENS.cyan, whiteSpace: 'nowrap' }}>{price}</div>}
      </div>
      {blurb && <div style={{ fontSize: 16, lineHeight: 1.45, color: t.textSecondary }}>{blurb}</div>}
      {badge && <div style={{ marginTop: 'auto' }}>{badge}</div>}
      {children}
      {on && (
        <span aria-hidden style={{ position: 'absolute', top: 12, right: 12, width: 26, height: 26, borderRadius: 999, background: JELLY_TOKENS.gradPrimary, color: JELLY_TOKENS.onGradient, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800 }}>
          ✓
        </span>
      )}
    </div>
  );
}

export function Badge({ children, tone = 'warn' }: { children: React.ReactNode; tone?: 'warn' | 'ok' | 'brand' | 'faint' }): React.ReactElement {
  const { t } = useTheme();
  const color = tone === 'warn' ? JELLY_TOKENS.warning : tone === 'ok' ? JELLY_TOKENS.success : tone === 'brand' ? JELLY_TOKENS.brandLight : t.textFaint;
  return (
    <span style={{ display: 'inline-block', fontSize: 13.5, fontWeight: 600, letterSpacing: '0.04em', color, border: `1px solid ${color}`, borderRadius: JELLY_TOKENS.radius.pill, padding: '4px 10px', lineHeight: 1.2 }}>
      {children}
    </span>
  );
}

/** Bottom bar: Back on the left, the ONE forward action on the right. */
export function StepNav({ onBack, next, backLabel = 'Back' }: { onBack?: () => void; next: React.ReactNode; backLabel?: string }): React.ReactElement {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
      <div>{onBack && <BigButton variant="ghost" onClick={onBack} data-testid="listing-back">← {backLabel}</BigButton>}</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{next}</div>
    </div>
  );
}

export const US_STATES: ReadonlyArray<[string, string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

export function stateName(code: string | null | undefined): string {
  const hit = US_STATES.find(([c]) => c === (code ?? '').toUpperCase());
  return hit ? hit[1] : code ?? '';
}

/**
 * The advertising rule the end card will honour for a state — plain words,
 * Part B of the plan. Unknown states get the strictest (PA-style) rule.
 */
export function stateAdRule(code: string | null | undefined): { headline: string; detail: string } {
  const s = (code ?? '').toUpperCase();
  if (s === 'MO') {
    return {
      headline: 'Your Missouri rule: broker name + phone on every video — we add it for you.',
      detail: 'Missouri (20 CSR 2250-8.070): every ad shows your broker’s licensed business name. If your name or phone appears, your broker’s name and phone appear too.',
    };
  }
  if (s === 'KS') {
    return {
      headline: 'Your Kansas rule: broker name right next to yours, never in tiny print — we add it for you.',
      detail: 'Kansas (K.S.A. 58-3086 / K.A.R. 86-3-7): the broker’s trade name sits adjacent to your name, and your name can be no more than twice the size of the broker’s.',
    };
  }
  if (s === 'PA') {
    return {
      headline: 'Your Pennsylvania rule: broker name + phone, same size as yours — we add it for you.',
      detail: 'Pennsylvania (49 Pa. Code §35.305): the employing broker’s name and phone appear in the ad itself, in letters the same size as yours.',
    };
  }
  if (!s) return { headline: 'Pick a state and we’ll show the advertising rule we follow for you.', detail: '' };
  return {
    headline: `Your ${stateName(s)} rules: broker name + phone on every video — we add it for you.`,
    detail: 'We apply the strictest common rule (broker name and phone, same size as yours, adjacent). Equal Housing Opportunity goes on every export.',
  };
}
