'use client';
import { useRef, useState } from 'react';
import { submitLead } from '@/lib/lead-capture-client';
import { browserAttribution } from '@/lib/discovery-browser';
import { trackEvent } from '@/components/analytics/site-tracker';
import { REPAIR_SERVICES, REPAIR_PHONE, REPAIR_SMS, REPAIR_TEL } from '@/lib/repair';
export function RepairInquiry() {
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (state === 'saving') return;
    const data = new FormData(event.currentTarget);
    if (!String(data.get('phone') || '').trim() && !String(data.get('email') || '').trim()) { setError('Please leave a phone number or email so Jared can reply.'); return; }
    setState('saving'); setError(''); requestId.current ||= crypto.randomUUID();
    try {
      await submitLead('/api/lead/action', { requestId: requestId.current, subsite: 'repair', action: 'request_property_help', contact: { name: String(data.get('name')).trim(), phone: String(data.get('phone') || '').trim() || undefined, email: String(data.get('email') || '').trim() || undefined }, fields: { services: data.getAll('services').join(', ') || 'unsure', address: String(data.get('address')).trim(), timeline: data.get('timeline'), notes: String(data.get('notes')).trim() }, attribution: browserAttribution(String(data.get('source') || '')) });
      setState('saved'); trackEvent('repair', 'inquiry_success', 'Property help');
    } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Your request was not saved. Please try again.'); }
  }
  if (state === 'saved') return <div role="status" className="rp-success"><h3>Your request is saved.</h3><p>Jared will follow up using the contact information you provided. This is an inquiry, not a confirmed appointment.</p><a href={REPAIR_SMS}>Text photos to {REPAIR_PHONE}</a></div>;
  return <form onSubmit={submit} className="rp-form">
    <fieldset><legend>What could you use a hand with? <span>Select any that apply.</span></legend><div className="rp-options">{REPAIR_SERVICES.map(s => <label key={s.id}><input type="checkbox" name="services" value={s.id}/>{s.label}</label>)}</div></fieldset>
    <div className="rp-fields"><label>Your name<input name="name" autoComplete="name" required maxLength={120}/></label><label>Property city or address<input name="address" autoComplete="street-address" required maxLength={200}/></label><label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40}/></label><label>Email<input name="email" type="email" autoComplete="email" maxLength={200}/></label></div>
    <p className="rp-small">A phone number or email is all we need to get back to you.</p>
    <label>What’s going on?<textarea name="notes" rows={4} required maxLength={2000} placeholder="A few repairs, a garage to clear, an inherited house… start wherever you are."/></label>
    <div className="rp-fields"><label>Your timing<select name="timeline" defaultValue="flexible"><option value="flexible">Flexible</option><option value="soon">As soon as available</option><option value="month">Within a month</option><option value="exploring">Just exploring</option></select></label><label>How did you find me? (optional)<input name="source" maxLength={300} placeholder="A friend, Google, ChatGPT…"/></label></div>
    {error && <p role="alert" className="rp-error">{error} <a href={REPAIR_TEL}>Call {REPAIR_PHONE}</a></p>}
    <button className="rp-button" disabled={state === 'saving'}>{state === 'saving' ? 'Saving your request…' : 'Send my request →'}</button>
    <p className="rp-small">You’re asking Jared to contact you about this request. No booking or payment required. <a href="/privacy">Privacy policy</a>.</p>
    <p className="rp-small">Have photos? <a href={REPAIR_SMS}>Text them to {REPAIR_PHONE}</a>.</p>
  </form>;
}
