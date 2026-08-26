'use client';

import React from 'react';

import { JELLY_TOKENS, glass } from '../tokens';
import { PillButton } from '../cinema';
import { AnimateSmsConsent } from '../AnimateSmsConsent';

/** Signed-out "Request a seat" form on the landing → POST /api/vater/invite-request
 *  → /hq Must Complete + Telegram.
 *
 *  Cinema pass 2026-08-16: the old `.jsl-*` (pink 1C) classes are gone; the
 *  fields are glass with a violet focus ring, styled inline from JELLY_TOKENS
 *  so this form looks identical whether it is dropped on the landing or on a
 *  legal page. The honeypot field and data-testid are unchanged — they are
 *  load-bearing for spam filtering and the audit sweep. */
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const UTM_STORAGE = 'jelly_utm';

/** First-touch UTMs, captured on any /animate page and kept for the session so an
 *  ad click that wanders through /animate/privacy before requesting still gets
 *  attributed (and, for the FB paid campaign, auto-approved server-side). */
function readUtm(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) fresh[k] = v.slice(0, 80);
    }
    if (Object.keys(fresh).length) {
      window.sessionStorage.setItem(UTM_STORAGE, JSON.stringify(fresh));
      return fresh;
    }
    const stored = window.sessionStorage.getItem(UTM_STORAGE);
    return stored ? (JSON.parse(stored) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function InviteRequestForm(): React.ReactElement {
  const [state, setState] = React.useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = React.useState<string>('');
  const [autoApproved, setAutoApproved] = React.useState(false);
  const [smsOptIn, setSmsOptIn] = React.useState(false);
  const [phone, setPhone] = React.useState('');
  const utmRef = React.useRef<Record<string, string>>({});
  React.useEffect(() => {
    utmRef.current = readUtm();
  }, []);

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
          utm: utmRef.current,
          phone,
          smsOptIn,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; autoApproved?: boolean };
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setAutoApproved(Boolean(j.autoApproved));
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
        <strong style={{ fontSize: 16 }}>You&apos;re in — check your email.</strong>
        <span style={{ fontSize: 14, color: t.textSecondary }}>
          {autoApproved
            ? 'Your signup link is on its way right now (check spam if it\u2019s not there in a minute).'
            : 'Your seat is reserved. A signup link will land in your inbox — check spam if it isn\u2019t there in a minute.'}
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
        <input name="email" type="email" required placeholder="Email for your seat" maxLength={200} aria-label="Email for your seat" />
      </div>
      <textarea
        name="about"
        rows={2}
        maxLength={600}
        aria-label="What do you want to make?"
        placeholder="What do you want to make? (channel, niche, how many videos a month)"
      />
      <AnimateSmsConsent
        variant="landing"
        checked={smsOptIn}
        onCheckedChange={setSmsOptIn}
        phone={phone}
        onPhoneChange={setPhone}
        disabled={state === 'busy'}
      />
      <div>
        <PillButton variant="gradient" size="lg" type="submit" disabled={state === 'busy'}>
          {state === 'busy' ? 'Sending…' : 'Request a seat'}
        </PillButton>
      </div>
      {state === 'error' && (
        <div style={{ fontSize: 13, color: JELLY_TOKENS.error }}>{msg} — or email jared@yourkchomes.com</div>
      )}
    </form>
  );
}
