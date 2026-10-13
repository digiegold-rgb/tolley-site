import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneE164, referenceCodes, deviceLabel, safeId } from '../lib/customer-history/core';
import { encryptMedia, decryptMedia } from '../lib/customer-history/media';
test('contact identities and references are exact, never IP based', () => {
  assert.equal(phoneE164('(913) 555-0123'), '+19135550123'); assert.equal(phoneE164('913-555'), undefined);
  assert.deepEqual(referenceCodes('Hi Ref: tly-123456abcdef Ref: TLY-123456ABCDEF'), ['TLY-123456ABCDEF']);
  assert.deepEqual(referenceCodes('TLY-12345'), []); assert.equal(safeId('------------------------------------'), undefined);
});
test('device labels avoid guessing desktop versus laptop from a Mac UA', () => {
  assert.equal(deviceLabel('Mozilla Macintosh Chrome/154.0 Safari/537.36'), 'Mac computer · Chrome');
  assert.equal(deviceLabel('Mozilla iPhone Version/26 Safari/604.1'), 'iPhone · Safari');
  assert.equal(deviceLabel('Mozilla Android Mobile Chrome/150'), 'Android phone · Chrome');
  assert.equal(deviceLabel('Mozilla iPad Safari/600'), 'iPad · Safari');
});
test('customer media is authenticated encrypted data, not public URLs', () => {
  process.env.CUSTOMER_MEDIA_KEY = '11'.repeat(32);
  const source = Buffer.from('private customer image'); const encrypted = encryptMedia(source);
  assert.notDeepEqual(source, encrypted); assert.deepEqual(decryptMedia(encrypted), source);
  encrypted[30] ^= 1; assert.throws(() => decryptMedia(encrypted));
  process.env.CUSTOMER_MEDIA_KEY = ''; assert.throws(() => encryptMedia(source));
});
