export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function safeId(v: unknown): string | undefined { return typeof v === 'string' && UUID.test(v) ? v : undefined; }
export function phoneE164(v: unknown): string | undefined {
  if (typeof v !== 'string') return;
  const n = v.replace(/\D/g, '');
  return n.length === 10 ? '+1' + n : n.length === 11 && n.startsWith('1') ? '+' + n : undefined;
}
export function referenceCodes(body: string): string[] { return [...new Set(body.toUpperCase().match(/\bTLY-[A-F0-9]{12}\b/g) || [])]; }
export function sameOrigin(req: Request) { const origin = req.headers.get('origin'); return !origin || origin === new URL(req.url).origin; }
export function deviceLabel(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const device = /iPad|Macintosh.*Mobile/.test(ua) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') : /Macintosh/.test(ua) ? 'Mac computer' : /Windows/.test(ua) ? 'Windows computer' : 'Other device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Unknown browser';
  return `${device} · ${browser}`;
}
