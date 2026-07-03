/**
 * lib/vater/billing/check-trial-caps.ts
 *
 * Free-tier (trial) cap enforcement. Runs BEFORE the budget check so users
 * without a paid subscription are blocked at the cap rather than charged.
 *
 * Caps (per VATER_TRIAL_CAPS):
 *   - 3 transcripts
 *   - 1 scene generation
 *   - 1 animated scene (5 sec max — not enforced here, enforced on Generate)
 */

import { prisma } from "@/lib/prisma";
import {
  VATER_TRIAL_CAPS,
  type VaterAction,
} from "@/lib/vater-subscription";

export interface TrialCapResult {
  allow: boolean;
  reason?: "trial_cap_reached" | "trial_cap_disabled";
  cap?: keyof typeof VATER_TRIAL_CAPS;
  capUsed?: number;
  capLimit?: number;
}

const ACTION_TO_CAP: Partial<Record<VaterAction, keyof typeof VATER_TRIAL_CAPS>> = {
  transcription: "transcripts",
  scene: "scenes",
  animation: "animations",
};

export async function checkTrialCaps(
  userId: string,
  action: VaterAction,
): Promise<TrialCapResult> {
  const capName = ACTION_TO_CAP[action];
  if (!capName) {
    // Action isn't capped during trial (script, voiceover, render, thumbnail,
    // description) — these still consume budget but don't gate the trial.
    return { allow: true };
  }

  const trial = await prisma.vaterTrialUsage.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const used = trial[capName];
  const limit = VATER_TRIAL_CAPS[capName];

  if (used >= limit) {
    return {
      allow: false,
      reason: "trial_cap_reached",
      cap: capName,
      capUsed: used,
      capLimit: limit,
    };
  }

  return { allow: true, cap: capName, capUsed: used, capLimit: limit };
}

/** Bump the appropriate cap counter after a successful trial action. */
export async function incrementTrialUsage(
  userId: string,
  action: VaterAction,
): Promise<void> {
  const capName = ACTION_TO_CAP[action];
  if (!capName) return;

  await prisma.vaterTrialUsage.upsert({
    where: { userId },
    create: { userId, [capName]: 1 },
    update: { [capName]: { increment: 1 } },
  });
}
