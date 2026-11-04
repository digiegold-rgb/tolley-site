import { z } from 'zod';
import { AREAS, areaLabel } from './areas';

export const equipmentValues = ['Washer & dryer', 'Washer only', 'Configuration unconfirmed'] as const;
export const serviceValues = ['Pump replacement', 'Leveling', 'Repair', 'Replacement', 'Maintenance'] as const;
export const partValues = ['Knobs', 'Washer hose', 'Dryer cable', 'Washer', 'Power switch', 'Dryer timer', 'Stacked unit', 'Tool bits', 'Tees and straps', 'Tool cart', 'Drum roller', 'Pump', 'Paint', 'Dryer outlet', 'Actuator', 'Wheel', 'Breaker'] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s);
const firstName = z.string().max(40).regex(/^[\p{L}][\p{L}'’\-]*$/u);
const id = z.string().regex(/^[res]_[a-f0-9]{16}$/);
const area = z.string().refine(s => AREAS.some(a => a.id === s)).nullable();
const equipment = z.enum(equipmentValues);
export const rentalSchema = z.object({ id, firstName, areaId: area, equipment, installedOn: date.nullable() }).strict();
export const eventSchema = z.object({ id, firstName, areaId: area, equipment, date, kind: z.enum(['installation', 'signup', 'service']) }).strict();
export const serviceSchema = z.object({ id, firstName, areaId: area, kind: z.enum(serviceValues), status: z.enum(['recorded', 'needs_attention']), date: date.nullable() }).strict();
export const snapshotSchema = z.object({
  version: z.literal(1), asOf: z.string().datetime(),
  rentals: z.array(rentalSchema), events: z.array(eventSchema), services: z.array(serviceSchema),
  parts: z.array(z.enum(partValues)), openSubscriptions: z.number().int().nonnegative(),
  coverage: z.object({ excludedRecords: z.number().int().nonnegative(), spreadsheetIncluded: z.boolean(), duplicateSubscriptions: z.number().int().nonnegative() }).strict(),
}).strict();
export type Rental = z.infer<typeof rentalSchema>;
export type Activity = z.infer<typeof eventSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Filters = { year: string; area: string; kind: string; query: string; from: string; to: string };
export const kindLabel = { installation: 'Installation', signup: 'Subscription start', service: 'Service' };
export function matchesDate(d: string | null, f: Filters) {
  return (f.year === 'all' || Boolean(d?.startsWith(f.year))) && (!f.from || Boolean(d && d >= f.from)) && (!f.to || Boolean(d && d <= f.to));
}
export function matchesPlace(r: { firstName: string; areaId: string | null }, f: Filters) {
  return (!f.area || (f.area === 'unknown' ? !r.areaId : r.areaId === f.area)) && `${r.firstName} ${areaLabel(r.areaId)}`.toLowerCase().includes(f.query.trim().toLowerCase());
}
export function filterActivity(rows: Activity[], f: Filters) { return rows.filter(r => matchesDate(r.date, f) && matchesPlace(r, f) && (f.kind === 'all' || r.kind === f.kind)); }
export function daily(rows: Activity[]) {
  const days: Record<string, Activity[]> = {};
  for (const r of rows) (days[r.date] ||= []).push(r);
  return days;
}
export function areaGroups(rows: { areaId: string | null }[]) {
  return AREAS.map(a => ({ ...a, count: rows.filter(r => r.areaId === a.id).length })).filter(a => a.count > 0).sort((a, b) => b.count - a.count);
}
export function heat(v: number, max: number) { return !v ? 0 : v <= max / 3 ? 1 : v <= max * 2 / 3 ? 2 : 3; }
export function exportCsv(events: Activity[]) {
  const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""')}"`;
  return [['Date', 'Activity', 'First name', 'City / area', 'Equipment'], ...events.map(e => [e.date, kindLabel[e.kind], e.firstName, areaLabel(e.areaId), e.equipment])].map(row => row.map(cell).join(',')).join('\r\n');
}
