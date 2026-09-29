/** Bind the exact existing Treasure Hauls Page token. Never prints credentials. */
import { PrismaClient } from '@prisma/client';
import { readFile, open } from 'node:fs/promises';
import { homedir } from 'node:os';
const db = new PrismaClient();
try {
  const settings = await db.liveSettings.findUnique({ where: { id: 'treasure-hauls' } });
  const id = settings?.bindings?.facebook?.accountId;
  if (id !== '1156652300855210') throw Error('Treasure Hauls Page binding changed; verify identity before provisioning.');
  const connection = await db.platformConnection.findFirst({ where: { subscriberId: 'social-suite', platform: `facebook_page:${id}`, platformAccountId: id, status: 'active' } });
  if (!connection) throw Error('Reconnect the bound Facebook Page in social settings.');
  const response = await fetch('https://graph.facebook.com/v23.0/me?fields=id,name', { headers: { Authorization: `Bearer ${connection.accessToken}` }, signal: AbortSignal.timeout(8000) });
  const page = await response.json();
  if (!response.ok || page.id !== id) throw Error('Facebook Page token identity could not be verified.');
  const file = `${homedir()}/.config/tolley-security/stream.env`;
  const values = { FACEBOOK_PAGE_ID: id, FACEBOOK_PAGE_TOKEN: connection.accessToken, FACEBOOK_BITRATE_K: '4500' };
  let lines = (await readFile(file, 'utf8')).trimEnd().split('\n');
  for (const [key, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) throw Error('Invalid credential format.');
    lines = lines.filter(line => !line.startsWith(`${key}=`));
    lines.push(`${key}=${value}`);
  }
  const handle = await open(file, 'w', 0o600);
  try { await handle.chmod(0o600); await handle.writeFile(`${lines.join('\n')}\n`); await handle.sync(); } finally { await handle.close(); }
  console.log(`Verified and provisioned Facebook Page ${page.id}: ${page.name}. No broadcast created or started.`);
} catch (error) { console.error(error instanceof Error && !/https?:|EAA/.test(error.message) ? error.message : 'Facebook provisioning failed. Credentials were not printed.'); process.exitCode = 1; }
finally { await db.$disconnect(); }
