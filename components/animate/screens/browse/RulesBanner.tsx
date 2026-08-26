'use client';

/* RulesBanner — one-line pointer to the online rulebook on the Characters tab
 * (Jared 8/25: "where is that file visible … on the character tab"). Since the
 * 8/25 PM scopes it is for EVERYONE: the Global rulebook every render reads +
 * the user's own rules. Reads the same GET /api/vater/rules the renders do. */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { useTier } from '../../tier-context';
import { relativeTimeLabel } from '@/lib/vater/concierge-client';
import type { RulesPayload } from './RulesScreen';

export function RulesBanner(): React.ReactElement | null {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const { loading } = useTier();
  const [data, setData] = React.useState<RulesPayload | null>(null);

  React.useEffect(() => {
    if (loading) return;
    let alive = true;
    fetch('/api/vater/rules?scope=global,owner', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: RulesPayload | null) => { if (alive && d) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [loading]);

  if (loading) return null;
  const global = data?.rules.filter((r) => r.scope === 'global') ?? [];
  const mine = data?.rules.filter((r) => r.scope === 'owner') ?? [];
  const last = global.reduce<RulesPayload['rules'][number] | null>((m, r) => (!m || r.updatedAt > m.updatedAt ? r : m), null);
  const hard = global.filter((r) => r.gate === 'hard').length;
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
      <span style={{ fontSize: 11.5, letterSpacing: '0.26em', textTransform: 'uppercase', color: JELLY_TOKENS.cyan }}>Global rulebook</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{data ? `${global.length} rules` : 'loading…'}</span>
      {data && (
        <>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, padding: '1px 7px', borderRadius: JELLY_TOKENS.radius.pill, color: '#E0405A', border: '1px solid #E0405A55', background: '#E0405A14', textTransform: 'uppercase' }}>{hard} hard</span>
          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: t.textSecondary }}>v{data.version}</span>
          {last && <span style={{ fontSize: 12, color: t.textSecondary }}>last edit {relativeTimeLabel(last.updatedAt)}</span>}
          <span style={{ fontSize: 12, fontWeight: 600, color: JELLY_TOKENS.brandLight }} data-testid="rules-banner-mine">My rules · {mine.length}</span>
        </>
      )}
      <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: JELLY_TOKENS.brandLight }}>Open →</span>
    </button>
  );
}
