/**
 * lib/vater/push.ts — Web Push (VAPID) to every browser a ROOT user has
 * subscribed via POST /api/vater/push/subscribe.
 *
 * Inert without env: when VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are missing
 * `sendPushToUser` returns {sent:0} and logs once — the stepped flow must
 * never depend on push being configured. Generate keys with
 * `npx web-push generate-vapid-keys`; env = VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:), NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * (same value as VAPID_PUBLIC_KEY, read by the client).
 *
 * `web-push` is CJS — default import under esModuleInterop, nodejs runtime
 * only (never import from an edge route).
 */
import "server-only";

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export interface PushPayload {
  title: string;
  body: string;
  /** Absolute deep link the service worker opens on click. */
  url: string;
  /** Collapses repeat notifications for the same project. */
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  removed: number;
  skipped?: "no_keys" | "no_subscriptions";
}

let configured: boolean | null = null;
function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.warn("[vater/push] VAPID keys not set — push disabled");
    configured = false;
    return false;
  }
  const subject = process.env.VAPID_SUBJECT || "mailto:jared@yourkchomes.com";
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/** The key the browser needs for `pushManager.subscribe`. */
export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? process.env.VAPID_PUBLIC_KEY ?? null;
}

export async function sendPushToUser(
  rootUserId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!ensureConfigured()) return { sent: 0, failed: 0, removed: 0, skipped: "no_keys" };

  const subs = await prisma.vaterPushSubscription.findMany({
    where: { userId: rootUserId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return { sent: 0, failed: 0, removed: 0, skipped: "no_subscriptions" };

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 60 * 60 * 24, urgency: "normal" },
      ),
    ),
  );

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      sent += 1;
      return;
    }
    failed += 1;
    const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
    if (status === 404 || status === 410) gone.push(subs[i].id);
    else console.warn(`[vater/push] send failed endpoint=${subs[i].endpoint.slice(0, 60)}… status=${status ?? "?"}`);
  });

  if (gone.length > 0) {
    await prisma.vaterPushSubscription
      .deleteMany({ where: { id: { in: gone } } })
      .catch((err) => console.error("[vater/push] prune failed", err));
  }
  return { sent, failed, removed: gone.length };
}
