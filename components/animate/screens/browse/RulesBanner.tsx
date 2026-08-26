'use client';

/* RulesBanner — one-line pointer to the online rulebook, shown on the
 * Characters tab for studio users (Jared 8/25: "where is that file visible …
 * on the character tab"). Reads the same GET /api/vater/rules the renders do. */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { useTier } from '../../tier-context';
import { relativeTimeLabel } from '@/lib/vater/concierge-client';
import type { RulesPayload } from './RulesScreen';

export function RulesBanner(): React.ReactElement | null {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const { capabilities, loading } = useTier();
  const [data, setData] = React.useState<RulesPayload | null>(null);

  React.useEffect(() => {
    if (loading || !capabilities.rules) return;
    let alive = true;
    fetch('/api/vater/rules', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RulesPayload | null) => { if (alive && d) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [loading, capabilities.rules]);

  if (loading || !capabilities.rules) return null;
  const last = data?.rules.reduce<RulesPayload['rules'][number] | null>((m, r) => (!m || r.updatedAt > m.updatedAt ? r : m), null) ?? null;
  const hard = data?.rules.filter((r) => r.gate === 'hard').length ?? 0;
  return (
    <button
      type="button"
      onClick={() => setRoute('rules')}
      data-testid="rules-banner"
      style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '10px 14px', borderRadius: JELLY_TOKENS.radius.md,
        background: JELLY_TOKENS.gradTicket, border: `1px solid ${JELLY_TOKENS.brandOutline}`, color: t.text,
      }}
    >
      <span style={{ fontSize: 11.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: JELLY_TOKENS.cyan }}>Director rulebook</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{data ? `${data.count} rules` : 'loading…'}</span>
      {data && (
        <>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, padding: '1px 7px', borderRadius: JELLY_TOKENS.radius.pill, color: '#E0405A', border: '1px solid #E0405A55', background: '#E0405A14', textTransform: 'uppercase' }}>{hard} hard</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: t.textSecondary }}>v{data.version}</span>
          {last && <span style={{ fontSize: 12, color: t.textSecondary }}>last edit {relativeTimeLabel(last.updatedAt)} by {last.updatedBy ?? '—'}</span>}
        </>
      )}
      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: JELLY_TOKENS.brandLight }}>Open Rules →</span>
    </button>
  );
}
