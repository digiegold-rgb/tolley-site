'use client';
import { useRef, useState } from 'react';
import { submitLead } from '@/lib/lead-capture-client';
import { browserAttribution } from '@/lib/discovery-browser';
import { trackEvent } from '@/components/analytics/site-tracker';
import { HM_CONTACT_PHONE } from '@/lib/homes';
const field = 'mt-1 w-full rounded-lg border border-sky-700/50 bg-slate-950 px-3 py-3 text-white';
export function SellerConsult() {
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState(''); const requestId = useRef<string | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (state === 'saving') return;
    const data = new FormData(e.currentTarget); setState('saving'); setError('');
    requestId.current ||= crypto.randomUUID();
    trackEvent('homes', 'inquiry_submit', 'Seller consultation');
    try {
      await submitLead('/api/lead/action', { requestId: requestId.current, subsite: 'homes', action: 'request_realtor_consult', contact: { name: data.get('name'), phone: data.get('phone'), email: data.get('email') || undefined }, fields: { intent: 'seller', address: data.get('address'), timeline: data.get('timeline'), situation: data.get('situation'), notes: data.get('notes') }, attribution: browserAttribution(String(data.get('source') || '')) });
      setState('saved'); trackEvent('homes', 'inquiry_success', 'Seller consultation');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setState('error'); }
  }
  return <section id="sell" className="scroll-mt-20 rounded-2xl border border-sky-700/50 bg-sky-950/30 p-6 sm:p-8"><h2 className="text-2xl font-bold text-white">Let’s talk about selling your home</h2><p className="mt-2 text-slate-300">Tell Jared about the property and your timing. Start with a free conversation, whether you’re ready now or sorting out the next step.</p>{state === 'saved' ? <div role="status" className="mt-6 rounded-xl bg-emerald-950 p-5 text-emerald-100">Your request is saved. Jared will follow up using the contact information you provided. For a time-sensitive question, call or text {HM_CONTACT_PHONE}.</div> : <form className="mt-6 grid gap-4 text-sm text-slate-200 sm:grid-cols-2" onSubmit={submit}>
    <label>Your name<input name="name" required maxLength={120} autoComplete="name" className={field}/></label>
    <label>Phone<input name="phone" type="tel" required maxLength={40} autoComplete="tel" className={field}/></label>
    <label>Email (optional)<input name="email" type="email" maxLength={200} autoComplete="email" className={field}/></label>
    <label>Property address or city<input name="address" required maxLength={200} autoComplete="street-address" className={field}/></label>
    <label>When are you thinking of selling?<select name="timeline" className={field} defaultValue="exploring"><option value="exploring">Exploring my options</option><option value="asap">As soon as possible</option><option value="30_days">Within 30 days</option><option value="90_days">Within 90 days</option></select></label>
    <label>Your situation<select name="situation" className={field}><option>Planning a move</option><option>Inherited property</option><option>Downsizing</option><option>Relocating</option><option>Rental or investment property</option><option>Something else</option></select></label>
    <label className="sm:col-span-2">What would help most? (optional)<textarea name="notes" rows={3} maxLength={2000} className={field} placeholder="Pricing, preparing the house, sorting belongings, or your timing…"/></label>
    <label className="sm:col-span-2">How did you find Jared? (optional)<input name="source" maxLength={300} className={field} placeholder="ChatGPT, Google, a friend, or somewhere else"/></label>
    {error && <p role="alert" className="text-red-300 sm:col-span-2">{error}</p>}
    <div className="sm:col-span-2"><button disabled={state === 'saving'} className="rounded-lg bg-sky-500 px-6 py-3 font-bold text-slate-950 disabled:opacity-50">{state === 'saving' ? 'Saving…' : 'Ask Jared about selling'}</button><p className="mt-3 text-xs text-slate-400">By submitting, you’re asking Jared to contact you about this property. <a className="underline" href="/privacy">Privacy policy</a>.</p></div>
  </form>}</section>;
}
