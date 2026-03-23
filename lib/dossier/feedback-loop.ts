/**
 * Dossier Feedback Loop — Phase 3 of dossier flow.
 *
 * After dossier completes, automatically:
 * 1. Merge motivation flags into Lead.scoreFactors
 * 2. Recalculate Lead.score with dossier signals
 * 3. Write discovered owner info back to Lead
 * 4. Trigger auto-responder if score + phone threshold met
 * 5. Send hot lead notification if motivation >= 60
 */

import { prisma } from "@/lib/prisma";

interface DossierFeedbackResult {
  leadUpdated: boolean;
  previousScore: number;
  newScore: number;
  autoResponderTriggered: boolean;
  hotLeadNotification: boolean;
  fieldsUpdated: string[];
}

export async function applyDossierFeedback(
  jobId: string
): Promise<DossierFeedbackResult> {
  const result: DossierFeedbackResult = {
    leadUpdated: false,
    previousScore: 0,
    newScore: 0,
    autoResponderTriggered: false,
    hotLeadNotification: false,
    fieldsUpdated: [],
  };

  // Load job + result + listing + lead
  const job = await prisma.dossierJob.findUnique({
    where: { id: jobId },
    include: {
      result: true,
      listing: {
        include: {
          leads: { take: 1, orderBy: { score: "desc" } },
        },
      },
    },
  });

  if (!job?.result || !job.listing) {
    console.log(`[Dossier Feedback] No result or listing for job ${jobId}`);
    return result;
  }

  const dossierResult = job.result;
  const lead = job.leadId
    ? await prisma.lead.findUnique({ where: { id: job.leadId } })
    : job.listing.leads[0] || null;

  if (!lead) {
    console.log(`[Dossier Feedback] No lead found for job ${jobId}`);
    return result;
  }

  result.previousScore = lead.score;
  const existingFactors = (lead.scoreFactors as Record<string, number>) || {};
  const dossierFactors: Record<string, number> = {};
  const updateData: Record<string, unknown> = {};

  // ── 1. Score adjustments from dossier findings ──

  // Court records bonus
  const courtCases = (dossierResult.courtCases || []) as Array<{ type: string }>;
  if (courtCases.length > 0) {
    const hasDivorce = courtCases.some((c) => c.type === "divorce");
    const hasForeclosure = courtCases.some((c) => c.type === "foreclosure");
    const hasProbate = courtCases.some((c) => c.type === "probate");
    const hasEviction = courtCases.some((c) => c.type === "eviction");

    if (hasDivorce) dossierFactors.dossier_divorce = 15;
    if (hasForeclosure) dossierFactors.dossier_foreclosure = 30;
    if (hasProbate) dossierFactors.dossier_probate = 15;
    if (hasEviction) dossierFactors.dossier_eviction = 10;
  }

  // Liens / bankruptcies
  const liens = (dossierResult.liens || []) as Array<{ type: string }>;
  const bankruptcies = (dossierResult.bankruptcies || []) as unknown[];
  if (liens.some((l) => l.type === "tax_lien")) dossierFactors.dossier_tax_lien = 20;
  if (bankruptcies.length > 0) dossierFactors.dossier_bankruptcy = 15;

  // High motivation score from dossier
  if (dossierResult.motivationScore != null && dossierResult.motivationScore >= 60) {
    dossierFactors.dossier_high_motivation = 15;
  }

  // Absentee/vacant from flags
  const flags = dossierResult.motivationFlags || [];
  if (flags.includes("absentee_owner")) dossierFactors.dossier_absentee = 10;
  if (flags.includes("vacant")) dossierFactors.dossier_vacant = 10;

  // Merge factors
  const mergedFactors = { ...existingFactors, ...dossierFactors };
  const dossierBonus = Object.values(dossierFactors).reduce((a, b) => a + b, 0);

  if (dossierBonus > 0) {
    const newScore = Math.min(100, lead.score + dossierBonus);
    result.newScore = newScore;
    updateData.score = newScore;
    updateData.scoreFactors = mergedFactors;
    result.fieldsUpdated.push("score", "scoreFactors");
  } else {
    result.newScore = lead.score;
  }

  // ── 2. Write discovered owner info back to Lead ──
  const owners = (dossierResult.owners || []) as Array<{
    name: string;
    phone?: string;
    email?: string;
  }>;

  if (owners.length > 0) {
    const primaryOwner = owners[0];

    if (primaryOwner.name && !lead.ownerName) {
      updateData.ownerName = primaryOwner.name;
      result.fieldsUpdated.push("ownerName");
    }
    if (primaryOwner.phone && !lead.ownerPhone) {
      updateData.ownerPhone = primaryOwner.phone;
      result.fieldsUpdated.push("ownerPhone");
    }
    if (primaryOwner.email && !lead.ownerEmail) {
      updateData.ownerEmail = primaryOwner.email;
      result.fieldsUpdated.push("ownerEmail");
    }
  }

  // ── 3. Apply updates ──
  if (Object.keys(updateData).length > 0) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: updateData,
    });
    result.leadUpdated = true;
    console.log(
      `[Dossier Feedback] Lead ${lead.id} updated: score ${result.previousScore} → ${result.newScore}, fields: ${result.fieldsUpdated.join(", ")}`
    );
  }

  // ── 4. Trigger auto-responder if score threshold + phone discovered ──
  const finalScore = (updateData.score as number) ?? lead.score;
  const finalPhone = (updateData.ownerPhone as string) ?? lead.ownerPhone;

  if (finalScore >= 40 && finalPhone && lead.status === "new") {
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXTAUTH_URL || "http://localhost:3000";
      const syncSecret = process.env.SYNC_SECRET;

      if (syncSecret) {
        const triggerRes = await fetch(
          `${baseUrl}/api/leads/auto-responder/trigger`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-sync-secret": syncSecret,
            },
            body: JSON.stringify({
              leads: [
                {
                  id: lead.id,
                  score: finalScore,
                  source: lead.source || "dossier",
                  ownerPhone: finalPhone,
                  listingId: lead.listingId,
                },
              ],
            }),
          }
        );

        if (triggerRes.ok) {
          const triggerData = await triggerRes.json();
          result.autoResponderTriggered = triggerData.triggered > 0;
          if (result.autoResponderTriggered) {
            console.log(`[Dossier Feedback] Auto-responder triggered for lead ${lead.id}`);
          }
        }
      }
    } catch (err) {
      console.error("[Dossier Feedback] Auto-responder trigger error:", err);
    }
  }

  // ── 5. Hot lead notification if motivation >= 60 ──
  if (
    dossierResult.motivationScore != null &&
    dossierResult.motivationScore >= 60
  ) {
    result.hotLeadNotification = true;
    console.log(
      `[Dossier Feedback] HOT LEAD: ${job.listing.address} — motivation ${dossierResult.motivationScore}, score ${finalScore}`
    );

    // Send notification via auto-responder system (agent notification path)
    try {
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXTAUTH_URL || "http://localhost:3000";
      const syncSecret = process.env.SYNC_SECRET;
      const notifyPhone = process.env.AGENT_NOTIFY_PHONE;

      if (syncSecret && notifyPhone) {
        await fetch(`${baseUrl}/api/sms/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-sync-secret": syncSecret,
          },
          body: JSON.stringify({
            to: notifyPhone,
            message: `HOT LEAD: ${job.listing.address}\nMotivation: ${dossierResult.motivationScore}/100\nScore: ${finalScore}\nFlags: ${flags.join(", ")}\nOwner: ${owners[0]?.name || "Unknown"}${finalPhone ? `\nPhone: ${finalPhone}` : ""}\n\nCheck: ${baseUrl}/leads/dossier/${jobId}`,
          }),
        });
      }
    } catch (err) {
      console.error("[Dossier Feedback] Hot lead notification error:", err);
    }
  }

  return result;
}
