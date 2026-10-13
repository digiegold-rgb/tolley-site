'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { SUBSITES } from '@/lib/subsites';
import { trackEvent } from '@/components/analytics/site-tracker';
import { journeyCapture } from '@/lib/customer-history/browser';
import { browserAttribution } from '@/lib/discovery-browser';
export function ContactTracker() {
  const path = usePathname();
  useEffect(() => {
    const s = SUBSITES.filter(s => path === s.url || path.startsWith(s.url + '/')).sort((a, b) => b.url.length - a.url.length)[0];
    if (s?.discovery?.disposition !== 'offering' && path !== '/services' && path !== '/' && path !== '/start') return;
    let disposed = false;
    // Prepare links before a user gesture; never delay native phone navigation.
    if (s?.discovery?.disposition === 'offering') fetch('/api/contact-reference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...journeyCapture(), offering: s.name, attribution: browserAttribution() }) }).then(r => r.ok ? r.json() : null).then(data => {
      if (disposed || !data?.code) return;
      for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="sms:"]')) {
        const raw = anchor.dataset.originalSms || anchor.getAttribute('href')!; anchor.dataset.originalSms = raw;
        const recipient = raw.split(/[?&]/)[0];
        const previous = new URLSearchParams(raw.replace(/^[^?&]*[?&]?/, '')).get('body') || `Hi Jared, I'm interested in ${s.title}.`;
        const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
        anchor.href = recipient + separator + 'body=' + encodeURIComponent(`${previous} Ref: ${data.code}`);
      }
    }).catch(() => {});
    const listener = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const target = e.target.closest('a,button');
      if (!target || target.hasAttribute('data-track-event') || target.hasAttribute('data-phone-click')) return;
      const href = target.getAttribute('href') || '';
      const event = href.startsWith('tel:') ? 'phone_click' : href.startsWith('sms:') ? 'sms_click' : target.tagName === 'A' ? 'link_click' : 'button_click';
      // Labels and destinations are bounded public UI data; no inputs or query strings.
      const destination = href.startsWith('/') ? href.split(/[?#]/)[0] : /^https?:/.test(href) ? new URL(href).origin : undefined;
      trackEvent(s?.name || 'home', event, target.textContent?.trim().slice(0, 100), { destination });
    };
    document.addEventListener('click', listener);
    return () => { disposed = true; document.removeEventListener('click', listener); };
  }, [path]);
  return null;
}
