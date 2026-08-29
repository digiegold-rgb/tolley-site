/**
 * Browser push client for the stepped create flow (2026-08-28).
 *
 * Registers `/public/sw.js`, subscribes through the PushManager with the
 * VAPID public key the server hands out, and records the subscription via
 * POST /api/vater/push/subscribe. Client-only; every function is safe to
 * call on a browser without push support (it just reports `unsupported`).
 *
 * No workbox, no library — the whole surface is four Web APIs.
 */

const SW_PATH = '/sw.js';
const SUBSCRIBE_ROUTE = '/api/vater/push/subscribe';

export type PushPermission = 'unsupported' | 'denied' | 'granted' | 'prompt';

export function isPushSupported(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  );
}

export function pushPermission(): PushPermission {
  if (!isPushSupported()) return 'unsupported';
  const p = Notification.permission;
  if (p === 'granted') return 'granted';
  if (p === 'denied') return 'denied';
  return 'prompt';
}

/** VAPID keys are URL-safe base64; PushManager wants raw bytes. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_PATH, { scope: '/' });
}

/** The subscription this browser already holds, if any. */
export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function fetchPublicKey(): Promise<string> {
  const res = await fetch(SUBSCRIBE_ROUTE, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Push is not configured (HTTP ${res.status})`);
  const data = (await res.json().catch(() => ({}))) as { publicKey?: string };
  const fromEnv = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const key = data.publicKey || fromEnv;
  if (!key) throw new Error('Push is not configured on this server');
  return key;
}

export interface SubscribeResult {
  ok: boolean;
  permission: PushPermission;
  error?: string;
}

/**
 * Ask for permission (if needed), subscribe, and tell the server. Idempotent:
 * an existing subscription is re-posted so a lost server row heals itself.
 */
export async function subscribePush(): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, permission: 'unsupported' };
  try {
    const reg = await registration();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, permission: permission === 'denied' ? 'denied' : 'prompt' };
    }
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const key = await fetchPublicKey();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }
    const json = sub.toJSON();
    const res = await fetch(SUBSCRIBE_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
        userAgent: navigator.userAgent.slice(0, 200),
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `Could not save the subscription (HTTP ${res.status})`);
    }
    return { ok: true, permission: 'granted' };
  } catch (err) {
    return {
      ok: false,
      permission: pushPermission(),
      error: err instanceof Error ? err.message : 'Could not turn on notifications',
    };
  }
}

/** Drop the browser subscription and the server row. */
export async function unsubscribePush(): Promise<boolean> {
  const sub = await currentPushSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  try {
    await sub.unsubscribe();
  } catch {
    /* the server row is deleted regardless */
  }
  try {
    await fetch(SUBSCRIBE_ROUTE, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    return false;
  }
  return true;
}
