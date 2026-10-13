import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
function key() { const value = process.env.CUSTOMER_MEDIA_KEY; if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error('CUSTOMER_MEDIA_KEY is not configured'); return Buffer.from(value, 'hex'); }
export function encryptMedia(bytes: Buffer): Buffer {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}
export function decryptMedia(bytes: Uint8Array): Buffer {
  const b = Buffer.from(bytes), decipher = createDecipheriv('aes-256-gcm', key(), b.subarray(0, 12));
  decipher.setAuthTag(b.subarray(12, 28)); return Buffer.concat([decipher.update(b.subarray(28)), decipher.final()]);
}
