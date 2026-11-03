export type Source = { file: string; page: number; sha256: string };
export type Delivery = {
  id: string; supplier: string; destination: string; address: string; city: string; state: string; zip: string;
  date: string | null; dateBasis: 'delivered' | 'shipped' | 'invoice' | 'unknown'; rawDate: string | null;
  weightLbs: number | null; rawWeight: string | null; documentNumber: string | null; orderNumber: string | null;
  lat: number | null; lng: number | null; geoPrecision: string | null;
  sources: Source[]; issues: string[]; notes: string; excluded?: boolean; reviewed?: boolean; routingNote?: string;
};
export type Archive = { version: 1; importedAt: string; sourceArchive: string; files: number; pages: number; duplicatePages: number; unrelatedPages: number; unreadableFiles: string[]; deliveries: Delivery[] };
export type Correction = { date?: string | null; weightLbs?: number | null; excluded?: boolean; notes?: string; reviewed?: boolean };
export type Metric = 'orders' | 'pounds' | 'visits';
export const emptyArchive: Archive = { version: 1, importedAt: '', sourceArchive: '', files: 0, pages: 0, duplicatePages: 0, unrelatedPages: 0, unreadableFiles: [], deliveries: [] };
export function validDate(s: unknown): s is string { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s; }
export function applyCorrection(d: Delivery, c: Correction): Delivery {
  const result = { ...d, ...c };
  if ('date' in c) { result.dateBasis = c.date ? 'delivered' : 'unknown'; result.issues = result.issues.filter(x => !x.startsWith('Date:')); }
  if ('weightLbs' in c) result.issues = result.issues.filter(x => !x.startsWith('Weight:'));
  return result;
}
export function totals(rows: Delivery[]) {
  const active = rows.filter(d => !d.excluded);
  const pounds = active.reduce((s, d) => s + (d.weightLbs ?? 0), 0);
  const knownWeight = active.filter(d => d.weightLbs !== null).length;
  const dated = active.filter(d => d.date);
  return { orders: active.length, pounds, knownWeight, unknownWeight: active.length - knownWeight, days: new Set(dated.map(d => d.date)).size, visits: new Set(dated.map(d => `${d.date}|${locationKey(d)}`)).size, undated: active.length - dated.length };
}
export function metricValue(rows: Delivery[], metric: Metric) { return totals(rows)[metric]; }
export function locationKey(d: Delivery) { return (d.address || d.destination).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function daily(rows: Delivery[]) {
  const days: Record<string, Delivery[]> = {};
  for (const d of rows) if (d.date && !d.excluded) (days[d.date] ||= []).push(d);
  return days;
}
export function filterDeliveries(rows: Delivery[], f: { year: string; supplier: string; query: string; from: string; to: string; includeExcluded?: boolean }) {
  const q = f.query.trim().toLowerCase();
  return rows.filter(d => (f.includeExcluded || !d.excluded) && (!f.supplier || d.supplier === f.supplier) && (!q || [d.destination, d.address, d.supplier, d.documentNumber, d.orderNumber].join(' ').toLowerCase().includes(q)) && (f.year === 'all' || d.date?.startsWith(f.year)) && (!f.from || (d.date !== null && d.date >= f.from)) && (!f.to || (d.date !== null && d.date <= f.to)));
}
export const AREA_STEP = 0.025; // ~1.7 miles north/south in Kansas City. Explicit grid, not administrative boundaries.
export function areaKey(d: Delivery) { return d.lat === null || d.lng === null ? null : `${Math.floor(d.lat / AREA_STEP)},${Math.floor(d.lng / AREA_STEP)}`; }
export function mapGroups(rows: Delivery[], mode: 'areas' | 'locations') {
  const groups = new Map<string, Delivery[]>();
  for (const d of rows) {
    if (d.excluded || !d.date || d.lat === null || d.lng === null || !['ROOFTOP', 'RANGE_INTERPOLATED', 'street', 'address'].includes(d.geoPrecision || '')) continue;
    const key = mode === 'areas' ? areaKey(d)! : locationKey(d);
    groups.set(key, [...(groups.get(key) || []), d]);
  }
  return [...groups].map(([key, deliveries]) => ({ key, deliveries, ...totals(deliveries), lat: deliveries[0].lat!, lng: deliveries[0].lng!, label: mode === 'areas' ? [...new Set(deliveries.map(d => [d.city, d.zip?.slice(0, 5)].filter(Boolean).join(' · ')))].filter(Boolean).join(' / ') || 'Delivery area' : deliveries[0].destination }));
}
export function intensity(value: number, max: number) { return value <= 0 ? 0 : max <= 0 ? 0 : value <= max / 3 ? 1 : value <= max * 2 / 3 ? 2 : 3; }
export function exportCsv(rows: Delivery[]) {
  const cell = (x: unknown) => { let s = String(x ?? ''); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replaceAll('"', '""')}"`; };
  const headers = ['Date', 'Date basis', 'Supplier', 'Destination', 'Address', 'Pounds', 'Document', 'Order', 'Source pages', 'Review notes'];
  return [headers, ...rows.map(d => [d.date, d.dateBasis, d.supplier, d.destination, d.address, d.weightLbs, d.documentNumber, d.orderNumber, d.sources.map(s => `${s.file} p.${s.page}`).join('; '), [d.notes, ...d.issues].filter(Boolean).join('; ')])].map(r => r.map(cell).join(',')).join('\r\n');
}

/** Next proxy may normalize the internal URL host to localhost. Compare the browser
 * Origin to the actual HTTP Host while retaining the request protocol and port. */
export function sameRequestOrigin(req: Request) {
  const url = new URL(req.url), host = req.headers.get('host');
  if (host) url.host = host;
  return req.headers.get('origin') === url.origin;
}
