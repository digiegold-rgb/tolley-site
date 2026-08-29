/**
 * lib/vater/flow-notify.ts — "the machine reached a step that needs you".
 *
 * One entry point for the three customer-facing transitions of the stepped
 * create flow (2026-08-28):
 *   script_ready → step 5 (draft parked at the approval gate)
 *   ready        → step 8 (video in the Library)
 *   qa           → step 7 (Fable 5 lane: a person is reviewing the render)
 *
 * Exactly-once: a CAS `updateMany … WHERE notified<Kind>At IS NULL` claims the
 * transition before anything is sent, so the 5-second re-polls, a poll racing
 * a concierge sync, or two tabs syncing the same job can never double-send.
 * Rewrite / reopen reset `notifiedScriptReadyAt`; produce resets
 * `notifiedReadyAt`, so the NEXT round trip notifies again.
 *
 * Delivery runs inside `after()` (feedback_vercel_after_not_fire_forget) —
 * the caller's response is never delayed by SMTP or the push service, and the
 * function stays alive until both land. Email goes to the ROOT login
 * (resolveTenantIdentity — a workspace tab has no email of its own); push goes
 * to every browser that root has subscribed.
 */
import "server-only";

import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import { stepUrl, type VariationJson } from "@/lib/vater/create-steps";
import { sendPushToUser } from "@/lib/vater/push";
import {
  sendConciergeQaEmail,
  sendScriptReadyEmail,
  sendVideoReadyEmail,
} from "@/lib/vater/animate-email";
import { readConcierge } from "@/lib/vater/concierge";

export type FlowNotifyKind = "script_ready" | "ready" | "qa";

export type FlowNotifyOutcome = "sent" | "already" | "missing" | "no_email";

const STAMP: Record<FlowNotifyKind, "notifiedScriptReadyAt" | "notifiedReadyAt" | "notifiedQaAt"> = {
  script_ready: "notifiedScriptReadyAt",
  ready: "notifiedReadyAt",
  qa: "notifiedQaAt",
};

const STEP: Record<FlowNotifyKind, number> = { script_ready: 5, ready: 8, qa: 7 };

function titleOf(p: { publishTitle: string | null; sourceTitle: string | null; topic: string | null }): string | null {
  return (p.publishTitle || p.sourceTitle || p.topic || "").trim() || null;
}

function variationCount(v: unknown): number | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const n = (v as Partial<VariationJson>).count;
  return typeof n === "number" && n > 0 ? n : null;
}

export async function notifyFlowTransition(
  projectId: string,
  kind: FlowNotifyKind,
  opts: { email?: boolean; push?: boolean } = {},
): Promise<FlowNotifyOutcome> {
  const stamp = STAMP[kind];
  const now = new Date();

  // 1. Claim the transition. count 0 = someone else already did (or the row
  //    is gone) — either way, nothing to send.
  const claimed = await prisma.youTubeProject.updateMany({
    where: { id: projectId, [stamp]: null },
    data: { [stamp]: now },
  });
  if (claimed.count === 0) return "already";

  const project = await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      userId: true,
      publishTitle: true,
      sourceTitle: true,
      topic: true,
      approvalExpiresAt: true,
      variationJson: true,
      settingsJson: true,
    },
  });
  if (!project?.userId) return "missing";

  // 2. Who gets it — the root login, never the tab.
  const identity = await resolveTenantIdentity(project.userId);
  const email = opts.email === false ? null : identity.email;
  const wantPush = opts.push !== false;
  if (!email && !wantPush) return "no_email";

  const title = titleOf(project);
  const url = stepUrl(project.id, STEP[kind]);
  const rewriteNo = variationCount(project.variationJson);
  const code = readConcierge(project.settingsJson)?.code ?? null;
  const label = title ? `"${title.length > 60 ? title.slice(0, 57) + "…" : title}"` : "Your video";

  const push =
    kind === "script_ready"
      ? { title: "Your script is ready to review", body: `${label} — approve (free) or rewrite.` }
      : kind === "ready"
        ? { title: "Your video is ready", body: `${label} is in your Library.` }
        : { title: "Fable 5 is reviewing your video", body: `${label} is in QA — delivery is next.` };

  // 3. Deliver after the response is sent.
  const deliver = async () => {
    if (email) {
      try {
        if (kind === "script_ready") {
          await sendScriptReadyEmail(email, {
            title,
            url,
            rewriteNo,
            expiresAt: project.approvalExpiresAt,
          });
        } else if (kind === "ready") {
          await sendVideoReadyEmail(email, { title, url });
        } else {
          await sendConciergeQaEmail(email, { code, title, url });
        }
      } catch (err) {
        console.error(`[vater/flow-notify] email failed project=${projectId} kind=${kind}`, err);
      }
    }
    if (wantPush) {
      try {
        const res = await sendPushToUser(identity.rootUserId, { ...push, url, tag: `jelly-${projectId}` });
        if (res.sent > 0 || res.failed > 0) {
          console.log(`[vater/flow-notify] push project=${projectId} kind=${kind} sent=${res.sent} failed=${res.failed} removed=${res.removed}`);
        }
      } catch (err) {
        console.error(`[vater/flow-notify] push failed project=${projectId} kind=${kind}`, err);
      }
    }
  };

  try {
    after(deliver);
  } catch {
    // Outside a request scope (script / test) — best effort.
    void deliver();
  }
  console.log(`[vater/flow-notify] project=${projectId} kind=${kind} → ${email ?? "(no email)"} + push(root=${identity.rootUserId})`);
  return "sent";
}
