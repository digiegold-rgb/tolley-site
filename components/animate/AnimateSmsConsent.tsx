'use client';

/**
 * Live A2P consent gate for Jelly Studio account texts.
 *
 * Unchecked by default. Same disclosure completeness as Wash & Dry
 * (`wd-sms-consent`) — frequency, rates, STOP/HELP, consent not required,
 * live Privacy + Terms links — with Animate copy and the Animate START
 * number (never 913-600-7508).
 */

import * as React from 'react';

import {
  ANIMATE_SMS_CONSENT_ID,
  ANIMATE_SMS_PRIVACY_URL,
  ANIMATE_SMS_TERMS_URL,
  animateSmsDisplayNumber,
  animateSmsStartLine,
} from '@/lib/animate-sms';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';

type Variant = 'landing' | 'studio';

export function AnimateSmsConsent(props: {
  variant: Variant;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  phone: string;
  onPhoneChange: (next: string) => void;
  disabled?: boolean;
  /** Landing form posts this name. Studio saves via PATCH. */
  phoneName?: string;
}): React.ReactElement {
  const { variant, checked, onCheckedChange, phone, onPhoneChange, disabled, phoneName = 'phone' } = props;
  const { t } = useTheme();
  const landing = variant === 'landing';
  const displayNumber = animateSmsDisplayNumber();
  const startLine = animateSmsStartLine();

  const labelColor = landing ? JELLY_TOKENS.dark.textSecondary : t.textSecondary;
  const faintColor = landing ? JELLY_TOKENS.dark.textFaint : t.textFaint;
  const linkColor = landing ? JELLY_TOKENS.brandLight : t.link;

  return (
    <div
      className={landing ? 'jc-invite-sms' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <input
        name={phoneName}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={checked ? 'Mobile number (required)' : 'Mobile number (optional)'}
        aria-label={checked ? 'Mobile number (required for texts)' : 'Mobile number (optional)'}
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        required={checked}
        disabled={disabled}
        maxLength={40}
        data-testid="animate-sms-phone"
        style={
          landing
            ? undefined
            : {
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 14px',
                fontSize: 15,
                fontFamily: JELLY_TOKENS.font,
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.cardAlt,
                color: t.text,
              }
        }
      />
      <label
        htmlFor={ANIMATE_SMS_CONSENT_ID}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <input
          id={ANIMATE_SMS_CONSENT_ID}
          name="smsOptIn"
          type="checkbox"
          value="true"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
          data-testid="animate-sms-consent"
          style={{ marginTop: 3, flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: 11.5,
            lineHeight: 1.45,
            color: labelColor ?? 'inherit',
          }}
        >
          I agree to receive recurring account texts from Jelly Studio (Your KC
          Homes LLC) when my film is ready and about my studio account. Up to 8
          msgs/month. Msg and data rates may apply. Reply STOP to cancel. Reply
          HELP for help. Consent is not required to request a seat or use the
          studio. Privacy{' '}
          <a
            href={ANIMATE_SMS_PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: linkColor,
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              wordBreak: 'break-all',
            }}
          >
            {ANIMATE_SMS_PRIVACY_URL}
          </a>{' '}
          Terms{' '}
          <a
            href={ANIMATE_SMS_TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: linkColor,
              fontWeight: 600,
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              wordBreak: 'break-all',
            }}
          >
            {ANIMATE_SMS_TERMS_URL}
          </a>
          .
        </span>
      </label>
      <p
        data-testid="animate-sms-start"
        style={{
          margin: 0,
          fontSize: 11.5,
          lineHeight: 1.45,
          color: faintColor ?? labelColor ?? 'inherit',
        }}
      >
        You can also opt in by texting START or YES to {displayNumber}.
        <span className="jsl-sr">{startLine}</span>
      </p>
    </div>
  );
}

/**
 * Signed-in studio account-texts panel. Loads and saves on the root User
 * (same consent owner as showcase opt-out). Never pre-checks the box.
 */
export function AnimateSmsOptInPanel(): React.ReactElement {
  const { t } = useTheme();
  const [checked, setChecked] = React.useState(false);
  const [phone, setPhone] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/me', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as {
          sms?: { optIn?: boolean; phone?: string | null };
        };
        if (cancelled) return;
        setChecked(Boolean(data.sms?.optIn));
        setPhone(data.sms?.phone ?? '');
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await fetch('/api/vater/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsOptIn: checked, phone }),
      });
      const data = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!r.ok) {
        setError(
          r.status === 403
            ? "Can't change this from a support session."
            : data.message || data.error || "Couldn't save that — try again.",
        );
        return;
      }
      setSaved(true);
    } catch {
      setError("Couldn't save that — try again.");
    } finally {
      setSaving(false);
    }
  }, [checked, phone]);

  return (
    <div
      style={{
        padding: 16,
        background: t.cardAlt,
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${t.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        color: t.textSecondary,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Account texts</div>
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>
        Optional. Get a text when a film is ready, and studio-account notices.
        Nothing is sent until you opt in.
      </div>
      <AnimateSmsConsent
        variant="studio"
        checked={checked}
        onCheckedChange={setChecked}
        phone={phone}
        onPhoneChange={setPhone}
        disabled={!loaded || saving}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!loaded || saving}
          style={{
            fontFamily: JELLY_TOKENS.font,
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: JELLY_TOKENS.radius.pill,
            border: `1px solid ${t.border}`,
            background: t.panel,
            color: t.text,
            cursor: !loaded || saving ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save text preferences'}
        </button>
        {saved ? <span style={{ fontSize: 12, color: JELLY_TOKENS.success }}>Saved.</span> : null}
      </div>
      {error ? <div style={{ fontSize: 12, color: JELLY_TOKENS.error }}>{error}</div> : null}
    </div>
  );
}
