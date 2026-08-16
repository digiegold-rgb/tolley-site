/**
 * lib/vater/api-webhooks.ts
 *
 * Completion webhooks for the public API (2026-08-16).
 *
 * An agent that POSTs /api/v1/videos gets an id back immediately; a long-form
 * render then takes 10-40 minutes. Polling that for half an hour is the sort
 * of integration that makes people give up, so a key can carry a `webhookUrl`
 * and we push the terminal state to it instead.
 *
 * ── DELIVERY CONTRACT ────────────────────────────────────────────────────
 * POST <webhookUrl>
 *   Content-Type: application/json
 *   X-Jelly-Event: video.ready | video.failed
 *   X-Jelly-Signature: sha256=<hmac of the raw body, keyed with the API key hash>
 *   { event, id, status, finalUrl, receipt: { totalUsd, minutes, computeUsd,
 *     opsUsd }, error, sentAt }
 *
 * Signed so the receiver can prove the callback came from us and not from
 * anyone who learned their endpoint URL. The HMAC key is the SHA-256 hash we
 * already store for the API key — never the key itself, which we do not have,
 * and which must not be recoverable from a body we send to a third party.
 * The receiver verifies with sha256(their key) as the HMAC secret.
 *
 * ── FAILURE POSTURE ──────────────────────────────────────────────────────
 * At-most-once, best-effort, no retry queue. This is called from the poll
 * route, which is on the customer's critical path: a slow or dead webhook
 * endpoint must never make somebody's render appear stuck. Every send is
 * time-boxed and every error is logged and swallowed. If a delivery is missed,
 * GET /api/v1/videos/{id} is still the authoritative answer — the docs say so.
 */

import "server-only";
import { createHmac } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { hasApiKeyTable } from "@/lib/vater/api-keys";
import { buildDebitLine } from "@/lib/vater/billing/ledger";

export type WebhookEvent = "video.ready" | "video.failed";

/** Hard ceiling per delivery. The poll route is waiting on this. */
const TIMEOUT_MS = 4000;

interface KeyTarget {
  keyHash: string;
  webhookUrl: string;
}

/** Live keys belonging to `userId` that have a webhook configured. */
async function targetsForUser(userId: string): Promise<KeyTarget[]> {
  if (!(await hasApiKeyTable())) return [];
  try {
    return await prisma.$queryRaw<KeyTarget[]>`
      SELECT "keyHash", "webhookUrl"
      FROM "VaterApiKey"
      WHERE "userId" = ${userId}
        AND "revokedAt" IS NULL
        AND "webhookUrl" IS NOT NULL
      LIMIT 10
    `;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

/**
 * Fire the completion callback for a project to every webhook its owner has
 * registered.
 *
 * Safe to call unconditionally: it returns immediately when the owner has no
 * keys, no webhooks, or the table has not been migrated. Never throws.
 */
export async function notifyWebhooksForProject(
  projectId: string,
  event: WebhookEvent,
): Promise<void> {
  try {
    const project = await prisma.youTubeProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        userId: true,
        status: true,
        sourceTitle: true,
        publishTitle: true,
        finalVideoUrl: true,
        errorMessage: true,
        audioDuration: true,
        targetDuration: true,
        costJson: true,
      },
    });
    if (!project?.userId) return;

    const targets = await targetsForUser(project.userId);
    if (targets.length === 0) return;

    const { line } = buildDebitLine(project);
    const body = JSON.stringify({
      event,
      id: project.id,
      status: project.status,
      title: project.publishTitle ?? project.sourceTitle ?? null,
      finalUrl: project.finalVideoUrl ?? null,
      error: event === "video.failed" ? (project.errorMessage ?? null) : null,
      receipt: {
        computeUsd: line.computeUsd,
        opsUsd: line.opsUsd,
        totalUsd: line.totalUsd,
        minutes: line.minutes,
      },
      sentAt: new Date().toISOString(),
    });

    await Promise.all(
      targets.map(async (target) => {
        const signature = createHmac("sha256", target.keyHash)
          .update(body, "utf8")
          .digest("hex");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await fetch(target.webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "JellyStudio-Webhook/1",
              "X-Jelly-Event": event,
              "X-Jelly-Signature": `sha256=${signature}`,
            },
            body,
            signal: controller.signal,
            cache: "no-store",
          });
          if (!res.ok) {
            console.error(
              `[api-webhooks] ${event} project=${projectId} -> ${target.webhookUrl} HTTP ${res.status}`,
            );
          }
        } catch (err) {
          // Includes the abort. Logged, never rethrown: the customer's render
          // is finished and their poll must not 500 over a dead endpoint.
          console.error(
            `[api-webhooks] ${event} project=${projectId} -> ${target.webhookUrl} failed`,
            err,
          );
        } finally {
          clearTimeout(timer);
        }
      }),
    );
  } catch (err) {
    console.error(`[api-webhooks] notify failed project=${projectId}`, err);
  }
}
