import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyCorrection, daily, exportCsv, filterDeliveries, mapGroups, totals, validDate, sameRequestOrigin, type Delivery } from '../lib/route-history/core';
const base: Delivery = { id: 'a', supplier: 'Example supply', destination: 'Test destination', address: '10 Example St, Kansas City MO', city: 'Kansas City', state: 'MO', zip: '64101', date: '2026-10-28', dateBasis: 'shipped', rawDate: '10/28/2026', weightLbs: 116, rawWeight: 'TOTAL WEIGHT 116', documentNumber: '100', orderNumber: '1', lat: 39.1, lng: -94.6, geoPrecision: 'ROOFTOP', sources: [{ file: 'sample.pdf', page: 1, sha256: 'example' }], issues: [], notes: '' };
test('orders, same-day destination visits, unknown pounds and undated records stay distinct', () => {
  const rows = [base, { ...base, id: 'b', orderNumber: '2', weightLbs: null }, { ...base, id: 'c', date: null, weightLbs: null }, { ...base, id: 'x', excluded: true }];
  assert.deepEqual(totals(rows), { orders: 3, pounds: 116, knownWeight: 1, unknownWeight: 2, days: 1, visits: 1, undated: 1 });
  assert.equal(daily(rows)['2026-10-28'].length, 2);
});
test('year, supplier, search and inclusive date range intersect; no fabricated date from filename', () => {
  const rows = [base, { ...base, id: 'old', date: '2025-10-28' }, { ...base, id: 'missing', date: null }];
  assert.equal(filterDeliveries(rows, { year: '2026', supplier: 'Example supply', query: 'example st', from: '2026-10-28', to: '2026-10-28' }).length, 1);
  assert.equal(filterDeliveries(rows, { year: 'all', supplier: '', query: '', from: '', to: '' }).length, 3);
  assert.equal(filterDeliveries(rows, { year: 'all', supplier: '', query: '', from: '2026-11-01', to: '2026-01-01' }).length, 0);
});
test('map excludes unknown dates and coarse locations; counts actual destination visits', () => {
  const rows = [base, { ...base, id: 'b' }, { ...base, id: 'coarse', geoPrecision: 'APPROXIMATE' }, { ...base, id: 'undated', date: null }];
  const groups = mapGroups(rows, 'areas');
  assert.equal(groups.length, 1); assert.equal(groups[0].orders, 2); assert.equal(groups[0].visits, 1);
});
test('owner corrections retain evidence and distinguish explicit zero from unknown', () => {
  const revised = applyCorrection(base, { date: '2026-10-29', weightLbs: 0 });
  assert.equal(revised.rawDate, '10/28/2026'); assert.equal(revised.rawWeight, 'TOTAL WEIGHT 116');
  assert.equal(revised.dateBasis, 'delivered'); assert.equal(totals([revised]).knownWeight, 1);
  assert.equal(totals([applyCorrection(base, { weightLbs: null })]).knownWeight, 0);
});
test('strict calendar validation and CSV formula escaping', () => {
  assert.equal(validDate('2026-02-29'), false); assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-11-03T00:00:00Z'), false);
  const csv = exportCsv([{ ...base, destination: '=HYPERLINK("bad")', weightLbs: null }]);
  assert.ok(csv.includes("'=HYPERLINK")); assert.ok(!csv.includes('undefined')); assert.ok(csv.includes('sample.pdf p.1'));
});

test('same-origin writes use the incoming host, preserving protocol and port', () => {
  const request = (origin?: string) => new Request('http://localhost:3027/api/route/history', { headers: { host: '127.0.0.1:3027', ...(origin ? { origin } : {}) } });
  assert.equal(sameRequestOrigin(request('http://127.0.0.1:3027')), true);
  assert.equal(sameRequestOrigin(request('https://untrusted.test')), false);
  assert.equal(sameRequestOrigin(request('http://127.0.0.1:3028')), false);
  assert.equal(sameRequestOrigin(request()), false);
});
