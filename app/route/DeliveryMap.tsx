'use client';
import { useEffect, useRef, useState } from 'react';
import { AREA_STEP, intensity, mapGroups, type Delivery, type Metric } from '@/lib/route-history/core';
type Layer = { addTo: (m: MapInstance) => Layer; bindTooltip: (text: HTMLElement) => Layer; on: (event: string, cb: () => void) => Layer };
type MapInstance = { remove: () => void; stop: () => void; setView: (point: number[], zoom: number) => MapInstance; fitBounds: (bounds: number[][], opts: object) => void; invalidateSize: (opts?: object) => void };
type Leaflet = { map: (element: HTMLElement, opts: object) => MapInstance; tileLayer: (url: string, opts: object) => Layer; rectangle: (bounds: number[][], opts: object) => Layer; circleMarker: (point: number[], opts: object) => Layer };
declare global { interface Window { L?: Leaflet } }
const colors = ['#cbd5e1', '#21a57a', '#dfa529', '#da6260'];
export default function DeliveryMap({ rows, metric, mode, onSelect }: { rows: Delivery[]; metric: Metric; mode: 'areas' | 'locations'; onSelect: (rows: Delivery[], label: string) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (window.L) { setReady(true); return; }
    const script = document.createElement('script'); script.src = '/route-assets/leaflet.js'; script.async = true;
    script.onload = () => setReady(true); script.onerror = () => setError('The map could not load. Your locations are still listed below.');
    document.head.appendChild(script);
    return () => { script.onload = null; script.onerror = null; script.remove(); };
  }, []);
  useEffect(() => {
    if (!ready || !el.current || !window.L) return;
    const L = window.L, map = L.map(el.current, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([39.02, -94.65], 10);
    const tile = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
    tile.on('tileerror', () => setError('Some map tiles could not load. Delivery markers and the location list are still available.'));
    const groups = mapGroups(rows, mode), max = Math.max(0, ...groups.map(g => g[metric]));
    for (const g of groups) {
      const value = g[metric], color = colors[intensity(value, max)];
      const options = { color, fillColor: color, fillOpacity: mode === 'areas' ? 0.38 : 0.8, weight: 2, radius: 7 + 12 * Math.sqrt(max ? value / max : 0) };
      let layer: Layer;
      if (mode === 'areas') { const [lat, lng] = g.key.split(',').map(Number); layer = L.rectangle([[lat * AREA_STEP, lng * AREA_STEP], [(lat + 1) * AREA_STEP, (lng + 1) * AREA_STEP]], options); }
      else layer = L.circleMarker([g.lat, g.lng], options);
      const label = document.createElement('span'); label.textContent = `${g.label}: ${g.orders} orders · ${g.visits} visits · ${g.pounds.toLocaleString(undefined, { maximumFractionDigits: 1 })} known lb${g.unknownWeight ? ` · ${g.unknownWeight} weights missing` : ''}`;
      layer.addTo(map).bindTooltip(label).on('click', () => onSelect(g.deliveries, g.label));
    }
    if (groups.length) map.fitBounds(groups.map(g => [g.lat, g.lng]), { padding: [40, 40], maxZoom: 12, animate: false });
    let disposed = false;
    const observer = new ResizeObserver(() => { if (!disposed) map.invalidateSize({ animate: false }); }); observer.observe(el.current);
    return () => { disposed = true; observer.disconnect(); map.stop(); map.remove(); };
  }, [ready, rows, metric, mode, onSelect]);
  return <><link rel="stylesheet" href="/route-assets/leaflet.css" />{error && <p className="route-notice" role="status">{error}</p>}<div className="route-map" ref={el} role="region" aria-label="Delivery activity map">{!ready && !error && <p>Loading map…</p>}</div></>;
}
