'use client';

import React from 'react';

import { JELLY_TOKENS, glass } from '../tokens';
import { PillButton } from '../cinema';

/** Signed-out "Request an invite" form on the landing → POST /api/vater/invite-request
 *  → /hq Must Complete + Telegram.
 *
 *  Cinema pass 2026-08-16: the old `.jsl-*` (pink 1C) classes are gone; the
 *  fields are glass with a violet focus ring, styled inline from JELLY_TOKENS
 *  so this form looks identical whether it is dropped on the landing or on a
 *  legal page. The honeypot field and data-testid are unchanged — they are
 *  load-bearing for spam filtering and the audit sweep. */
export function InviteRequestForm(): React.ReactElement {
  const [state, setState] = React.useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = React.useState<string>('');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setState('busy');
    try {
      const r = await fetch('/api/vater/invite-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          email: fd.get('email'),
          about: fd.get('about'),
          website: fd.get('website'), // honeypot
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setState('done');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  };

  const t = JELLY_TOKENS.dark;

  if (state === 'done') {
    return (
      <div
        role="status"
        style={{
          ...glass(t),
          borderRadius: JELLY_TOKENS.radius.lg,
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          textAlign: 'left',
          fontFamily: JELLY_TOKENS.font,
          color: t.text,
        }}
      >
        <strong style={{ fontSize: 16 }}>Got it — you&apos;re on the list.</strong>
        <span style={{ fontSize: 14, color: t.textSecondary }}>
          Invites go out in small batches; you&apos;ll get a signup link by email.
        </span>
      </div>
    );
  }

  return (
    <form
      className="jc-invite"
      onSubmit={onSubmit}
      data-testid="invite-request-form"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}
    >
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} />
      <div className="jc-invite-row">
        <input name="name" placeholder="Your name (optional)" maxLength={120} aria-label="Your name (optional)" />
        <input name="email" type="email" required placeholder="Email for your invite link" maxLength={200} aria-label="Email for your invite link" />
      </div>
      <textarea
        name="about"
        rows={2}
        maxLength={600}
        aria-label="What do you want to make?"
        placeholder="What do you want to make? (channel, niche, how many videos a month)"
      />
      <div>
        <PillButton variant="gradient" size="lg" type="submit" disabled={state === 'busy'}>
          {state === 'busy' ? 'Sending…' : 'Request an invite'}
        </PillButton>
      </div>
      {state === 'error' && (
        <div style={{ fontSize: 13, color: JELLY_TOKENS.error }}>{msg} — or email jared@yourkchomes.com</div>
      )}
    </form>
  );
}
