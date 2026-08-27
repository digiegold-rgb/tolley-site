'use client';

/**
 * SupportStrip — "Call / Text Jared" row under the wizard stepper.
 *
 * Boomer-agent rule: a phone number they can tap beats any help drawer.
 * Reads `useProduct().support` so the number lives in brands.ts only.
 * `expanded` = the failure state: bigger buttons and the "who answers" line.
 */
import * as React from 'react';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme } from '../../theme-context';
import { useProduct } from '../../product-context';

function prettyPhone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return e164;
}

export interface SupportStripProps {
  expanded?: boolean;
  /** Pre-filled text body, e.g. "Listing Studio help — job abc123". */
  smsBody?: string;
  style?: React.CSSProperties;
}

export function SupportStrip({ expanded = false, smsBody, style }: SupportStripProps): React.ReactElement | null {
  const { t } = useTheme();
  const { support } = useProduct();
  const phone = support.phone;
  const sms = support.sms ?? support.phone;
  if (!phone && !sms) return null;

  const body = encodeURIComponent(smsBody ?? 'Listing Studio help');
  const btn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: expanded ? '14px 22px' : '10px 16px',
    borderRadius: JELLY_TOKENS.radius.pill,
    fontFamily: JELLY_TOKENS.font,
    fontSize: expanded ? 18 : 16,
    fontWeight: 600,
    textDecoration: 'none',
    color: t.text,
    border: `1px solid ${JELLY_TOKENS.brandOutline}`,
    background: JELLY_TOKENS.brandGhost,
    whiteSpace: 'nowrap',
  };

  return (
    <div
      data-testid="listing-support-strip"
      data-slot="support-strip"
      style={{
        ...glass(t),
        borderRadius: JELLY_TOKENS.radius.lg,
        padding: expanded ? '18px 20px' : '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        fontFamily: JELLY_TOKENS.font,
        color: t.text,
        fontSize: 16,
        ...style,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: '1 1 220px' }}>
        <span style={{ fontWeight: 600 }}>{expanded ? 'Stuck? A real person answers.' : 'Need a hand? Call or text.'}</span>
        <span style={{ fontSize: expanded ? 15 : 14, color: t.textSecondary }}>
          {support.who ?? 'Jared answers himself'}
          {support.hours ? ` · ${support.hours}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {phone && (
          <a href={`tel:${phone}`} style={btn} data-testid="listing-support-call" aria-label={`Call ${prettyPhone(phone)}`}>
            <span aria-hidden>📞</span> Call {prettyPhone(phone)}
          </a>
        )}
        {sms && (
          <a href={`sms:${sms}?&body=${body}`} style={btn} data-testid="listing-support-text" aria-label="Text us">
            <span aria-hidden>💬</span> Text
          </a>
        )}
      </div>
    </div>
  );
}

export default SupportStrip;
