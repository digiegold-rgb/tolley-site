'use client';

import React from 'react';

/** Signed-out "Request an invite" form on the landing → POST /api/vater/invite-request
 *  → /hq Must Complete + Telegram. Styled with the landing's .jsl-* tokens. */
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

  if (state === 'done') {
    return (
      <div className="jsl-invite-form jsl-invite-done" role="status">
        <strong>Got it — you&apos;re on the list.</strong>
        <span>Invites go out in small batches; you&apos;ll get a signup link by email.</span>
      </div>
    );
  }

  return (
    <form className="jsl-invite-form" onSubmit={onSubmit} data-testid="invite-request-form">
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999 }} />
      <div className="jsl-invite-row">
        <input name="name" placeholder="Your name (optional)" maxLength={120} />
        <input name="email" type="email" required placeholder="Email for your invite link" maxLength={200} />
      </div>
      <textarea name="about" rows={2} maxLength={600} placeholder="What do you want to make? (channel, niche, how many videos a month)" />
      <button className="jsl-btn jsl-btn-pink" type="submit" disabled={state === 'busy'}>
        {state === 'busy' ? 'Sending…' : 'Request an invite'}
      </button>
      {state === 'error' && <div className="jsl-invite-err">{msg} — or email support@tolley.io</div>}
    </form>
  );
}
