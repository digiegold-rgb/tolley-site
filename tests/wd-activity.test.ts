import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSnapshot, cityOnly, firstNameOnly } from '../lib/wd-activity/project';
import { areaGroups, filterActivity, snapshotSchema, exportCsv } from '../lib/wd-activity/core';
const client = { id: 'secret-client-id', name: 'Jamie PrivateLast', address: '123 Secret Street, Independence, MO 64055', unitDescription: 'Washer & dryer, Pump replaced', installDate: '2025-11-04', notes: 'Private medical and payment note $1234', stripeCustomerId: 'cus_secret', stripeSubscriptionId: 'sub_secret' };
const fixture = () => buildSnapshot({ clients: [client], repairs: [{ name: 'Pump' }, { name: 'PrivateLast repair at 123 Secret Street $400' }], subscriptions: [{ id: 'sub_secret', customer: 'cus_secret', status: 'active', start: 1762304400 }], customers: { cus_secret: { name: 'Jamie PrivateLast' } }, asOf: '2026-11-04T03:00:00.000Z' });
test('public projection excludes personal, financial, source IDs and coordinate fields throughout JSON and CSV', () => {
  const snapshot = fixture(), publicText = JSON.stringify(snapshot) + exportCsv(snapshot.events);
  for (const secret of ['PrivateLast', '123 Secret', 'medical', '$1234', '$400', 'cus_secret', 'sub_secret', 'secret-client-id']) assert.ok(!publicText.includes(secret), secret);
  assert.equal(snapshot.rentals[0].firstName, 'Jamie'); assert.equal(snapshot.rentals[0].areaId, 'independence');
  assert.deepEqual(snapshot.parts, ['Pump']); assert.equal(snapshot.services[0].date, null);
  assert.ok(!/"(?:address|phone|email|notes|amount|profit|cost|lat|lng|stripeCustomerId)":/.test(JSON.stringify(snapshot)));
});
test('strict public schema fails closed on unexpected fields and exact locations', () => {
  const s = fixture();
  assert.equal(snapshotSchema.safeParse({ ...s, profit: 123 }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...s, rentals: [{ ...s.rentals[0], address: '123 Secret Street' }] }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...s, rentals: [{ ...s.rentals[0], areaId: '123 Secret Street' }] }).success, false);
  assert.equal(snapshotSchema.safeParse({ ...s, rentals: [{ ...s.rentals[0], firstName: 'Jamie PrivateLast' }] }).success, false);
});
test('only explicit metro city labels are plotted, using predefined city centers', () => {
  assert.equal(cityOnly('123 Unknown Rd'), null); assert.equal(cityOnly('123 Street, Las Vegas, NV'), null);
  assert.equal(cityOnly('123 Street, Kansas City, KS 66102'), 'kc-ks'); assert.equal(cityOnly('123 Street KCMO'), 'kc-mo');
  const groups = areaGroups([{ areaId: 'independence' }, { areaId: null }]); assert.equal(groups.length, 1); assert.equal(groups[0].count, 1);
});
test('installs, subscription starts and undated maintenance are separate; staff/test/placeholder records are excluded', () => {
  const s = buildSnapshot({ clients: [client, { ...client, id: 'wd_test_x', name: 'Test' }, { ...client, id: 'staff', unitDescription: 'Field tech — not a rental' }, { ...client, id: 'lost', name: 'Lost Client 1' }, { ...client, id: 'undated', installDate: null, stripeSubscriptionId: null, unitDescription: 'Configuration unknown' }], repairs: [], subscriptions: [{ id: 'one', customer: 'cus_secret', status: 'canceled', start: 1762304400 }, { id: 'one', customer: 'cus_secret', status: 'canceled', start: 1762304400 }], customers: {}, asOf: '2026-11-04T03:00:00.000Z' });
  assert.equal(s.rentals.length, 2); assert.equal(s.coverage.excludedRecords, 3); assert.equal(s.events.length, 2); assert.equal(s.openSubscriptions, 0); assert.equal(s.services.length, 1); assert.equal(s.services[0].date, null); assert.equal(s.coverage.duplicateSubscriptions, 1);
  assert.equal(s.events.filter(e => e.kind === 'service').length, 0);
});
test('filters intersect and date ranges are inclusive', () => {
  const s = fixture(), f = { year: '2025', area: 'independence', kind: 'installation', query: 'jamie', from: '2025-11-04', to: '2025-11-04' };
  assert.equal(filterActivity(s.events, f).length, 1); assert.equal(filterActivity(s.events, { ...f, query: 'unknown' }).length, 0); assert.equal(filterActivity(s.events, { ...f, year: '2026' }).length, 0);
});
test('first-name formatting avoids emails, companies and compound surnames', () => {
  assert.equal(firstNameOnly('PrivateLast, Jamie'), 'Jamie'); assert.equal(firstNameOnly('person@example.com'), 'Resident'); assert.equal(firstNameOnly('Business LLC'), 'Resident'); assert.equal(firstNameOnly('Jamie/Casey PrivateLast'), 'Jamie');
});
