'use client';

import { useRef, useState } from 'react';
import { submitLead } from '@/lib/lead-capture-client';
import { browserAttribution } from '@/lib/discovery-browser';
import { trackEvent } from '@/components/analytics/site-tracker';
import { PC_PARTS, PC_PHONE, PC_SMS, PC_TEL, PC_USES } from '@/lib/pc';

export function PcBuildInquiry() {
  const [state, setState] = useState<'idle' | 'saving' | 'error' | 'saved'>('idle');
  const [error, setError] = useState('');
  const saving = useRef(false);
  const requestId = useRef<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) || '').trim();
    if (!value('name') || !value('city') || !value('notes')) {
      setError('Please add your name, city, and a little about your build.'); return;
    }
    if (!value('phone') && !value('email')) {
      setError('Leave a phone number or email so Jared can get back to you.'); return;
    }
    saving.current = true; setState('saving'); setError('');
    try {
      requestId.current ||= crypto.randomUUID();
      await submitLead('/api/lead/action', {
        requestId: requestId.current, subsite: 'pc', action: 'request_pc_build',
        contact: { name: value('name'), phone: value('phone') || undefined, email: value('email') || undefined },
        fields: { useCase: value('useCase'), parts: value('parts'), city: value('city'), budget: value('budget'), partsList: value('partsList'), notes: value('notes'), ...(value('preferredDate') ? { preferredDate: value('preferredDate') } : {}) },
        attribution: browserAttribution(value('source')),
      });
      setState('saved');
      requestAnimationFrame(() => statusRef.current?.focus());
      trackEvent('pc', 'inquiry_success', 'Custom PC build');
    } catch (e) {
      setState('error'); setError(e instanceof Error ? e.message : 'Your request was not saved. Please try again or call Jared.');
    } finally { saving.current = false; }
  }

  if (state === 'saved') return <div className="pc-success" ref={statusRef} tabIndex={-1} role="status">
    <span className="pc-success-mark" aria-hidden="true">✓</span><p className="pc-eyebrow">REQUEST RECEIVED</p>
    <h3>Your next build starts here.</h3><p>Your request is saved. Jared will follow up using the contact information you provided to discuss the parts, quote, and timing.</p>
    <p className="pc-small">Your build date will be confirmed directly with Jared.</p><a className="pc-button pc-button-light" href={PC_SMS}>Text Jared ↗</a>
  </div>;

  return <form className="pc-form" method="post" onSubmit={submit} aria-label="Custom PC build request">
    <fieldset><legend>01 <span>What will you use it for?</span></legend><div className="pc-use-options">
      {[...PC_USES, { id: 'unsure', name: 'Help me decide' }].map((u, i) => <label key={u.id}><input type="radio" name="useCase" value={u.id} defaultChecked={i === 0}/><span>{u.name}</span></label>)}
    </div></fieldset>
    <fieldset><legend>02 <span>Where are you with parts?</span></legend><div className="pc-parts-options">
      {PC_PARTS.map((p, i) => <label key={p.id}><input type="radio" name="parts" value={p.id} defaultChecked={i === 0}/><span><strong>{p.name}</strong><small>{p.detail}</small></span></label>)}
    </div></fieldset>
    <fieldset><legend>03 <span>A little about your build</span></legend>
      <label>Your goals<textarea name="notes" required maxLength={2000} rows={3} placeholder="Games or software, a quiet desk setup, a compact case, an all-out workstation…"/></label>
      <div className="pc-fields"><label>Approximate budget <span>(optional)</span><input name="budget" maxLength={160} placeholder="e.g. $1,500 including parts"/></label><label>Preferred date <span>(optional)</span><input name="preferredDate" type="date"/></label></div>
      <label>Parts list or link <span>(optional)</span><textarea name="partsList" maxLength={1500} rows={2} placeholder="Paste a PCPartPicker link or list the parts you have."/></label>
    </fieldset>
    <fieldset><legend>04 <span>How can Jared reach you?</span></legend><div className="pc-fields">
      <label>Your name<input name="name" required autoComplete="name" maxLength={120}/></label>
      <label>Your city<input name="city" required autoComplete="address-level2" maxLength={120} placeholder="City, state"/></label>
      <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40}/></label>
      <label>Email<input name="email" type="email" autoComplete="email" maxLength={200}/></label>
    </div><p className="pc-small">A phone number or email is enough. Please provide at least one.</p>
      <label>How did you find me? <span>(optional)</span><input name="source" maxLength={300} placeholder="A friend, Google, ChatGPT…"/></label>
    </fieldset>
    {error && <p role="alert" className="pc-error">{error} <a href={PC_TEL}>Call {PC_PHONE}</a>.</p>}
    <button className="pc-button" disabled={state === 'saving'}>{state === 'saving' ? 'Saving your request…' : 'Let’s talk about your build'} <span aria-hidden="true">↗</span></button>
    <p className="pc-small">You’re asking Jared to contact you about this build. No payment or commitment. Price and scheduling are confirmed together. <a href="/privacy">Privacy policy</a>.</p>
    <noscript><style>{'.pc-form fieldset,.pc-form>button{display:none}'}</style><p>To request a build without JavaScript, <a href={PC_TEL}>call {PC_PHONE}</a> or <a href={PC_SMS}>text Jared</a>.</p></noscript>
  </form>;
}
