'use client';

/**
 * SupportStrip — self-service help and support tickets under the wizard.
 *
 * Reads the brand support email; the Help drawer files tickets with context.
 * `expanded` = the failure state, with a larger help button.
 */
import * as React from 'react';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { useProduct } from '../../product-context';

export interface SupportStripProps {
  expanded?: boolean;
  /** Pre-filled text body, e.g. "Listing Studio help — job abc123". */
  smsBody?: string;
  style?: React.CSSProperties;
}

export function SupportStrip({ expanded = false, smsBody, style }: SupportStripProps): React.ReactElement | null {
  const { t } = useTheme();
  const { support } = useProduct();
  const { openHelp } = useRoute();

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
        <span style={{ fontWeight: 600 }}>{expanded ? 'Something went wrong? Send a support ticket.' : 'Need help? Start here.'}</span>
        <span style={{ fontSize: expanded ? 15 : 14, color: t.textSecondary }}>
          Read the instructions or report a problem from Help.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={openHelp} style={{ ...btn, cursor: 'pointer' }} data-testid="listing-support-help">
          Help &amp; support tickets
        </button>
        <a href={`mailto:${support.email}?subject=${body}`} style={btn} data-testid="listing-support-email">
          Email support
        </a>
      </div>
    </div>
  );
}

export default SupportStrip;
