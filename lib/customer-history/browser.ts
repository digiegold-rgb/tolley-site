'use client';
import { browserAttribution } from '@/lib/discovery-browser';
import { visitorSessionId } from '@/lib/lead-capture-client';
import { normalizeAttribution } from '@/lib/discovery-attribution';
export function visitorId(): string | undefined {
  if (typeof window === 'undefined' || navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  try {
    const record = JSON.parse(localStorage.getItem('tolley.visitor.v1') || 'null');
    if (record?.id && record.expires > Date.now()) return record.id;
    const id = crypto.randomUUID(); localStorage.setItem('tolley.visitor.v1', JSON.stringify({ id, expires: Date.now() + 365 * 86400000 })); return id;
  } catch { return; }
}
export function journeyCapture() {
  const latestTouch = browserAttribution(); let firstTouch = latestTouch;
  const id = visitorId();
  try {
    const saved = JSON.parse(localStorage.getItem('tolley.first-touch.v1') || 'null');
    if (saved?.visitorId === id && id) firstTouch = normalizeAttribution(saved.attribution) || latestTouch;
    else if (id) localStorage.setItem('tolley.first-touch.v1', JSON.stringify({ visitorId: id, attribution: latestTouch }));
  } catch { /* storage unavailable */ }
  return { visitorId: id, sessionId: visitorSessionId(), firstTouch, latestTouch };
}
declare global { interface Navigator { readonly globalPrivacyControl?: boolean } }
