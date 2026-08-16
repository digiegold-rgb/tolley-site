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

interface MeImpersonation {
  impersonation?: {
    active?: boolean;
    adminEmail?: string | null;
    readOnly?: boolean;
  };
  email?: string | null;
}

export function ViewAsBanner(): React.ReactElement | null {
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
        background: JELLY_TOKENS.error,
        color: '#fff',
        fontFamily: JELLY_TOKENS.font,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
        textAlign: 'center',
      }}
    >
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
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.7)',
          background: 'rgba(0,0,0,0.18)',
          color: '#fff',
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
