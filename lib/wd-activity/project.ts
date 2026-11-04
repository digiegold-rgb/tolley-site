// Offline/server-only projection. Never import private source data into a client component.
import { createHash } from 'node:crypto';
import { AREAS } from './areas';
import { snapshotSchema, partValues, type Snapshot, type Rental, type Activity, type Service } from './core';
type Client = { id: string; name: string; address: string | null; unitDescription: string; installDate: string | Date | null; notes?: string | null; stripeCustomerId: string | null; stripeSubscriptionId: string | null };
type Subscription = { id: string; customer: string; status: string; start: number };
export type PrivateSource = { clients: Client[]; repairs: { name: string }[]; subscriptions: Subscription[]; customers: Record<string, { name: string | null }>; asOf: string };
const publicId = (prefix: string, source: string) => `${prefix}_${createHash('sha256').update('wd-activity:' + source).digest('hex').slice(0, 16)}`;
export function firstNameOnly(name: string | null | undefined) {
  if (!name || /@|\b(llc|inc|company|test|lost|client|customer)\b/i.test(name)) return 'Resident';
  const part = (name.includes(',') ? name.split(',')[1] : name).trim().split(/[\s/&]+/)[0];
  return /^[\p{L}][\p{L}'’\-]{0,39}$/u.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : 'Resident';
}
export function cityOnly(address: string | null) {
  if (!address) return null;
  const s = address.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ');
  for (const a of AREAS) {
    if (a.id.startsWith('kc-')) continue;
    const name = a.label.split(',')[0].toLowerCase().replace(/[’']/g, '');
    if (new RegExp(`\\b${name}\\b`).test(s)) return a.id;
  }
  if (/\bkcmo\b/.test(s)) return 'kc-mo';
  if (/\bkck\b/.test(s)) return 'kc-ks';
  if (/\bkansas city\b/.test(s)) {
    if (/\bks\b|\b661\d{2}\b/.test(s)) return 'kc-ks';
    if (/\bmo\b|\bmissouri\b|\b641\d{2}\b/.test(s)) return 'kc-mo';
  }
  // Incomplete addresses and billing addresses outside the metro stay unplotted.
  return null;
}
export function equipmentOnly(description: string): Rental['equipment'] {
  if (/washer\s+only|washer ONLY/i.test(description)) return 'Washer only';
  if (/washer.*dryer|\bw\s*[&/]\s*d\b|\bw\b.*\bd\b|\bd\b.*\bw\b|bundle/i.test(description)) return 'Washer & dryer';
  return 'Configuration unconfirmed';
}
function installationDay(value: Client['installDate']) {
  if (!value) return null;
  const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}
export function buildSnapshot(source: PrivateSource): Snapshot {
  // Placeholders, staff/test fixtures and explicitly unresolved duplicates are not rentals.
  const eligible = source.clients.filter(c => !/^wd_(test|worker)_/.test(c.id) && !/\btest\b|not a rental|not a real rental|field tech/i.test(c.unitDescription) && !/^lost\s+client\b/i.test(c.name) && !/second unit same address - verify|possible duplicate|\(dup\?\)/i.test(`${c.unitDescription} ${c.notes || ''}`));
  const seen = new Set<string>();
  const clients = eligible.filter(c => { if (!c.stripeSubscriptionId) return true; if (seen.has(c.stripeSubscriptionId)) return false; seen.add(c.stripeSubscriptionId); return true; });
  const rentals: Rental[] = clients.map(c => ({ id: publicId('r', c.id), firstName: firstNameOnly(c.name), areaId: cityOnly(c.address), equipment: equipmentOnly(c.unitDescription), installedOn: installationDay(c.installDate) }));
  const events: Activity[] = rentals.filter(r => r.installedOn).map(r => ({ id: publicId('e', r.id + ':install'), firstName: r.firstName, areaId: r.areaId, equipment: r.equipment, date: r.installedOn!, kind: 'installation' }));
  const subscriptions = [...new Map(source.subscriptions.map(s => [s.id, s])).values()];
  for (const s of subscriptions) {
    const exact = clients.filter(c => c.stripeSubscriptionId === s.id);
    const byCustomer = clients.filter(c => c.stripeCustomerId === s.customer);
    const client = exact.length === 1 ? exact[0] : byCustomer.length === 1 ? byCustomer[0] : null;
    if (!Number.isFinite(s.start) || s.start <= 0) continue;
    events.push({ id: publicId('e', s.id), firstName: firstNameOnly(source.customers[s.customer]?.name || client?.name), areaId: client ? cityOnly(client.address) : null, equipment: client ? equipmentOnly(client.unitDescription) : 'Configuration unconfirmed', date: new Date(s.start * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }), kind: 'signup' });
  }
  const services: Service[] = [];
  for (const c of clients) {
    const r = rentals.find(x => x.id === publicId('r', c.id))!;
    if (/pump replaced/i.test(c.unitDescription)) services.push({ id: publicId('s', c.id + ':pump'), firstName: r.firstName, areaId: r.areaId, kind: 'Pump replacement', status: 'recorded', date: null });
    if (/needs to be level|needs level/i.test(c.unitDescription)) services.push({ id: publicId('s', c.id + ':level'), firstName: r.firstName, areaId: r.areaId, kind: 'Leveling', status: 'needs_attention', date: null });
  }
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const partKeys = new Set(source.repairs.map(r => normalize(r.name === 'Stacked' ? 'Stacked unit' : r.name)));
  return snapshotSchema.parse({ version: 1, asOf: source.asOf, rentals, events, services, parts: partValues.filter(p => partKeys.has(normalize(p))), openSubscriptions: subscriptions.filter(s => ['active', 'trialing'].includes(s.status)).length, coverage: { excludedRecords: source.clients.length - clients.length, spreadsheetIncluded: false, duplicateSubscriptions: source.subscriptions.length - subscriptions.length } });
}
