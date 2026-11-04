'use client';
import { useEffect, useRef, useState } from 'react';
import { areaGroups, heat } from '@/lib/wd-activity/core';
type Group = ReturnType<typeof areaGroups>[number];
export default function AreaMap({ groups, measure, onSelect }: { groups: Group[]; measure: string; onSelect: (id: string) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (window.L) { setReady(true); return; }
    const script = document.createElement('script'); script.src = '/route-assets/leaflet.js'; script.async = true;
    script.onload = () => setReady(true); script.onerror = () => setError('The map could not load. City totals are listed below.'); document.head.appendChild(script);
    return () => { script.onload = null; script.onerror = null; script.remove(); };
  }, []);
  useEffect(() => {
    if (!ready || !element.current || !window.L) return;
    const L = window.L, map = L.map(element.current, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([39.04, -94.55], 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 13, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map).on('tileerror', () => setError('Some map tiles could not load. City totals remain available below.'));
    const max = Math.max(1, ...groups.map(g => g.count));
    for (const g of groups) {
      const color = ['#bdcbd0', '#21a57a', '#dfa529', '#da6260'][heat(g.count, max)];
      const label = document.createElement('span'); label.textContent = `${g.label}: ${g.count} ${measure}. City summary.`;
      L.circleMarker([g.lat, g.lng], { color, fillColor: color, fillOpacity: .72, weight: 3, radius: 11 + 23 * Math.sqrt(g.count / max) }).addTo(map).bindTooltip(label).on('click', () => onSelect(g.id));
    }
    if (groups.length) map.fitBounds(groups.map(g => [g.lat, g.lng]), { padding: [60, 60], maxZoom: 10, animate: false });
    let disposed = false; const observer = new ResizeObserver(() => { if (!disposed) map.invalidateSize({ animate: false }); }); observer.observe(element.current);
    return () => { disposed = true; observer.disconnect(); map.stop(); map.remove(); };
  }, [ready, groups, measure, onSelect]);
  return <><link rel="stylesheet" href="/route-assets/leaflet.css" />{error && <p role="status" className="route-notice">{error}</p>}<div className="route-map" ref={element} role="region" aria-label="Rental activity by city">{!ready && <p>Loading city map…</p>}</div></>;
}
