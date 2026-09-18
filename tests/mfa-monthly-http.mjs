import assert from 'node:assert/strict';
import { randomUUID, randomBytes, scryptSync, createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { encode, decode } from 'next-auth/jwt';
import { requireIsolatedServer, totp } from './helpers/owner-session.mjs';

const base = 'http://127.0.0.1:3018';
requireIsolatedServer(base);
// Next dev normalizes loopback NextRequest URLs to localhost.
const browserOrigin = 'http://localhost:3018';
const secret = 'security-test-secret-only';
const p = new PrismaClient();
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
const jar = new Map();
const user = await p.user.create({ data: {
  email: `mfa-monthly-${randomUUID()}@example.invalid`,
  credentialAuth: { create: { passwordHash: `${salt}:${scryptSync(password, salt, 64).toString('hex')}` } },
} });
const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
async function request(path, body, { cookies = cookie(), origin = browserOrigin, form = false } = {}) {
  return fetch(base + path, { redirect: 'manual', method: body === undefined ? 'GET' : 'POST',
    headers: { cookie: cookies, origin, host: 'localhost:3018', 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    ...(body === undefined ? {} : { body: form ? new URLSearchParams(body) : JSON.stringify(body) }),
  });
}
function remember(response) {
  for (const value of response.headers.getSetCookie()) {
    const pair = value.split(';')[0], index = pair.indexOf('=');
    jar.set(pair.slice(0, index), pair.slice(index + 1));
  }
}
try {
  const csrf = await request('/api/auth/csrf');
  remember(csrf);
  const { csrfToken } = await csrf.json();
  remember(await request('/api/auth/callback/credentials', {
    csrfToken, email: user.email, password, callbackUrl: base + '/agent',
  }, { form: true }));
  const tokenName = 'authjs.session-token';
  assert(jar.has(tokenName), 'real password login issued a session');
  const token = await decode({ token: jar.get(tokenName), secret, salt: tokenName });
  const agedCookie = async (overrides = {}) => `${tokenName}=` + await encode({ secret, salt: tokenName,
    token: { ...token, authAt: Math.floor(Date.now() / 1000) - 29 * 86400, ...overrides }, maxAge: 30 * 86400 });
  const aged = await agedCookie();

  assert.equal((await request('/api/auth/mfa/setup', {}, { cookies: aged })).status, 401);
  const setupResponse = await request('/api/auth/mfa/setup', {});
  assert.equal(setupResponse.status, 200);
  const setup = await setupResponse.json();
  assert.equal((await request('/api/auth/mfa/verify', { code: totp(setup.secret) }, { cookies: aged })).status, 403,
    'an old session cannot finish initial authenticator enrollment');
  const initial = await request('/api/auth/mfa/verify', { code: totp(setup.secret) });
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get('set-cookie'), /Max-Age=2592000/i);
  remember(initial);
  let session = await (await request('/api/auth/session')).json();
  assert.equal(session.user.id, user.id);

  const challenge = await request('/login/mfa-challenge?callbackUrl=%2Fhq', undefined, { cookies: aged });
  assert.equal(challenge.status, 200);
  const html = await challenge.text();
  assert.match(html, /30 days/);
  assert.doesNotMatch(html, /Your sign-in challenge expired/);
  assert.match(html, /6-Digit Code/);
  assert.equal((await request('/api/auth/mfa/disable', { code: totp(setup.secret) }, { cookies: aged })).status, 401);
  assert.equal((await request('/api/auth/mfa/verify', { code: '000000' }, { cookies: '' })).status, 401);
  assert.equal((await request('/api/auth/mfa/verify', { code: setup.backupCodes[0], isBackupCode: true },
    { cookies: aged, origin: 'https://wrong.example' })).status, 403);

  // A valid existing enrollment can renew using its recovery code after the old 20-minute window.
  const renewed = await request('/api/auth/mfa/verify', { code: setup.backupCodes[0], isBackupCode: true }, { cookies: aged });
  assert.equal(renewed.status, 200);
  const header = renewed.headers.getSetCookie().find(value => value.startsWith('tolley_mfa='));
  assert.match(header, /Max-Age=2592000/i);
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=lax/i);
  const proofCookie = header.split(';')[0];
  session = await (await request('/api/auth/session', undefined, { cookies: aged + '; ' + proofCookie })).json();
  assert.equal(session.user.id, user.id);
  session = await (await request('/api/auth/session', undefined, {
    cookies: (await agedCookie({ authSessionId: randomUUID() })) + '; ' + proofCookie,
  })).json();
  assert.equal(session.mfaRequired, 'verify');
  assert.equal(session.user, undefined);
  assert.equal((await request('/api/auth/mfa/verify', { code: setup.backupCodes[0], isBackupCode: true },
    { cookies: aged })).status, 403, 'recovery code cannot be reused');

  // Re-sign time-shifted fixtures to exercise the real session gate at monthly expiry.
  const data = JSON.parse(Buffer.from(proofCookie.slice('tolley_mfa='.length).split('.')[0], 'base64url').toString());
  for (const [remaining, expected] of [[86400, undefined], [-1, 'verify']]) {
    const payload = Buffer.from(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + remaining })).toString('base64url');
    const signature = createHmac('sha256', secret).update(`mfa:${payload}`).digest('base64url');
    session = await (await request('/api/auth/session', undefined, {
      cookies: aged + `; tolley_mfa=${payload}.${signature}`,
    })).json();
    assert.equal(session.mfaRequired, expected);
    if (!expected) assert.equal(session.user.id, user.id);
  }
  await p.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  assert.equal((await request('/api/auth/mfa/verify', { code: setup.backupCodes[1], isBackupCode: true },
    { cookies: aged })).status, 401, 'revoked login cannot renew verification');
  console.log('PASS: real sign-in, enrollment, 30-day cookie, old-session renewal UI/API, expiry, login binding, revocation, origin, and recovery replay.');
} finally {
  await p.rateLimitBucket.deleteMany({ where: { OR: [
    { key: { startsWith: `mfa:replay:${user.id}:` } }, { key: `mfa:user:${user.id}` },
  ] } });
  await p.user.delete({ where: { id: user.id } });
  await p.$disconnect();
}
