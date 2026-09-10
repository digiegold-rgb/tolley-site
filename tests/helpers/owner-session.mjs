import assert from 'node:assert/strict';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';

export function requireIsolatedServer(base) {
  const database = new URL(process.env.DATABASE_URL || 'postgresql://invalid');
  if (base !== 'http://127.0.0.1:3018' || database.hostname !== '127.0.0.1'
    || database.port !== '55438' || database.pathname !== '/tolley_revenue_test') {
    throw new Error('Disposable localhost app/database required');
  }
}

export function totp(secret) {
  let bits = 0, value = 0;
  const bytes = [];
  for (const c of secret) {
    value = (value << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);
    bits += 5;
    if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  return String((mac.readUInt32BE(mac[19] & 15) & 0x7fffffff) % 1000000).padStart(6, '0');
}

// Runs the real credentials, CSRF and MFA endpoints. No production credentials
// or signed-cookie bypasses; the fixture account only exists in the test DB.
export async function createOwnerSession(p, base) {
  requireIsolatedServer(base);
  const email = 'security-admin@example.invalid';
  const password = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  const user = await p.user.create({ data: { email,
    credentialAuth: { create: { passwordHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}` } },
  } });
  const jar = new Map();
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  async function request(path, body, form = false) {
    const response = await fetch(base + path, {
      redirect: 'manual', method: body ? 'POST' : 'GET',
      headers: { cookie: cookie(), origin: base,
        'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
      ...(body ? { body: form ? new URLSearchParams(body) : JSON.stringify(body) } : {}),
    });
    for (const item of response.headers.getSetCookie()) {
      const pair = item.split(';')[0], index = pair.indexOf('=');
      jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  const cleanup = () => p.user.delete({ where: { id: user.id } });
  try {
    const { csrfToken } = await (await request('/api/auth/csrf')).json();
    assert(csrfToken, 'CSRF token issued');
    await request('/api/auth/callback/credentials', { csrfToken, email, password, callbackUrl: base + '/hq' }, true);
    assert([...jar.keys()].some(name => name.includes('authjs.session-token')), 'credentials login issued session');
    assert.equal((await request('/api/wd/clients')).status, 401, 'owner denied before MFA');
    const enrollment = await request('/api/auth/mfa/setup', {});
    assert.equal(enrollment.status, 200, 'owner enrollment requires test server ADMIN_ALLOWLIST_EMAILS=security-admin@example.invalid');
    const setup = await enrollment.json();
    const verification = await request('/api/auth/mfa/verify', { code: totp(setup.secret) });
    assert.equal(verification.status, 200, 'authenticator verified');
    assert.equal((await request('/api/wd/auth', {})).status, 200, 'verified owner accepted');
    return { cookie: cookie(), cleanup };
  } catch (error) {
    await cleanup().catch(() => {});
    throw error;
  }
}
