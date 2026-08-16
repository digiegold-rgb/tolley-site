'use client';

/* ViewAsBanner — the red bar across the top of Jelly Studio while an admin is
 * running a "view as user" support session.
 *
 * WHY IT IS LOUD. Impersonation that doesn't look like impersonation is how
 * someone ends up convinced a bug is real because they were staring at a
 * different account's data — or worse, tries to "just fix it" and finds every
 * button 403ing with no explanation. The bar states whose account this is,
 * that it is read-only, and gives one click out.
 *
 * State comes from GET /api/vater/me (`impersonation`), which reads the
 * signed cookie server-side. Nothing here can start a session — only end one.
 */

import * as React from 'react';

import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { MicroLabel } from './cinema';

/* The impersonation bar keeps its RED semantics — this is the one place in the
 * studio where the cinema palette gives way, because "you are inside someone
 * else's account" must not read as decoration. Glass, but error-tinted. */
const ERROR_TINT = 'linear-gradient(160deg, rgba(240,96,122,0.20), rgba(240,96,122,0.10))';
const ERROR_OUTLINE = 'rgba(240,96,122,0.55)';
const ERROR_INK = 'rgba(240,96,122,0.14)';

interface MeImpersonation {
  impersonation?: {
    active?: boolean;
    adminEmail?: string | null;
    readOnly?: boolean;
  };
  email?: string | null;
}

export function ViewAsBanner(): React.ReactElement | null {
  const { t } = useTheme();
  const [state, setState] = React.useState<{
    active: boolean;
    viewingEmail: string | null;
    adminEmail: string | null;
  }>({ active: false, viewingEmail: null, adminEmail: null });
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/me', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as MeImpersonation;
        if (cancelled || !data.impersonation?.active) return;
        setState({
          active: true,
          viewingEmail: data.email ?? null,
          adminEmail: data.impersonation.adminEmail ?? null,
        });
      } catch {
        /* No banner is the correct failure mode — it can only ever be shown
           in addition to the real server-side enforcement, never instead. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const exit = React.useCallback(async () => {
    setExiting(true);
    try {
      await fetch('/api/admin/vater/view-as', { method: 'DELETE' });
    } catch {
      /* fall through — the reload below is what actually matters */
    }
    // Full reload, not a router refresh: the session identity itself changed,
    // so every cached client fetch under it has to be thrown away.
    window.location.href = '/animate';
  }, []);

  if (!state.active) return null;

  return (
    <div
      role="alert"
      data-testid="view-as-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '10px 16px',
        background: ERROR_TINT,
        backdropFilter: t.glassBlur,
        WebkitBackdropFilter: t.glassBlur,
        borderBottom: `1px solid ${ERROR_OUTLINE}`,
        color: JELLY_TOKENS.error,
        fontFamily: JELLY_TOKENS.font,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        textAlign: 'center',
      }}
    >
      <MicroLabel tone="text" as="span" color={JELLY_TOKENS.error} size={10.5} tracking="0.26em">
        ● Support session
      </MicroLabel>
      <span>
        Viewing as {state.viewingEmail ?? 'this customer'} — read-only
        {state.adminEmail ? ` · signed in as ${state.adminEmail}` : ''}
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={exiting}
        data-testid="view-as-exit"
        style={{
          padding: '4px 14px',
          borderRadius: JELLY_TOKENS.radius.pill,
          border: `1px solid ${ERROR_OUTLINE}`,
          background: ERROR_INK,
          color: JELLY_TOKENS.error,
          fontFamily: JELLY_TOKENS.font,
          fontSize: 12,
          fontWeight: 700,
          cursor: exiting ? 'progress' : 'pointer',
        }}
      >
        {exiting ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  );
}
