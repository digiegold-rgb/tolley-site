/**
 * POST /api/vater/listing/verify-license — { state, licenseNumber }
 *
 * MO = live Primary Source Verification (mopro.mo.gov scrape); KS = format
 * check → manual_review; every other state → manual_review. Result is
 * written to the ROOT user's VaterAccount (agent-profile.ts). manual_review
 * files a MustCompleteItem (category signups, yellow) + Telegram so Jared
 * resolves it from /hq (vater-users POST set-license).
 *
 * Rate limit 10/min per IP (same as /api/leads/digest/verify-license) plus
 * 20/hour per human so the state registry can't be enumerated from an account.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";
import { verifyLicense, type LicenseState } from "@/lib/leads/license-verify";
import { consumeRateLimit, rateLimitByIp, rateLimited } from "@/lib/rate-limit";
import { queueVaterEvent } from "@/lib/vater/events";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import { agentProfileReady, AgentProfileNotReadyError, writeLicenseResult } from "@/lib/vater/listing/agent-profile";
import { listingError, loginRequired, NO_STORE } from "@/lib/vater/listing/store";
import type { VerifyLicenseRequest, VerifyLicenseResponse } from "@/lib/vater/listing/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOT_READY = NextResponse.json(
  { error: "FEATURE_NOT_READY", message: "Apply prisma/migrations/20260827_vater_account_origin_license/migration.sql first." },
  { status: 503, headers: NO_STORE },
);

/** Telegram parse_mode is Markdown — unbalanced _ * ` [ ] 400s the send. */
function tgSafe(v: string): string {
  return v.replace(/[_*`[\]]/g, "");
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  if (!(await agentProfileReady())) return NOT_READY;

  const limitedIp = await rateLimitByIp(request, "listing:verify-license", 10, 60);
  if (limitedIp) return limitedIp;
  const ident = await resolveTenantIdentity(session.user.id);
  const rl = await consumeRateLimit(`vater:listing:verify:${ident.rootUserId}`, 20, 3600);
  if (!rl.allowed) return rateLimited(rl);

  let body: Partial<VerifyLicenseRequest>;
  try {
    body = (await request.json()) as Partial<VerifyLicenseRequest>;
  } catch {
    return listingError(400, { error: "Invalid JSON" });
  }
  const state = typeof body.state === "string" ? body.state.trim().toUpperCase().slice(0, 2) : "";
  const licenseNumber = typeof body.licenseNumber === "string" ? body.licenseNumber.trim().slice(0, 30) : "";
  if (!/^[A-Z]{2}$/.test(state)) return listingError(400, { error: "state must be a 2-letter code" });
  if (!licenseNumber) return listingError(400, { error: "licenseNumber is required" });

  const live = state === "MO" || state === "KS";
  const result = live
    ? await verifyLicense(state as LicenseState, licenseNumber)
    : { status: "manual_review" as const, reason: `${state} licenses are verified by a human within a few hours` };

  try {
    await writeLicenseResult(ident.rootUserId, {
      state,
      licenseNumber,
      status: result.status,
      licenseeName: result.status === "verified" ? result.licenseeName ?? null : null,
      profession: result.status === "verified" ? result.profession ?? null : null,
      expirationDate: result.status === "verified" ? result.expirationDate ?? null : null,
    });
  } catch (err) {
    if (err instanceof AgentProfileNotReadyError) return NOT_READY;
    console.error("[listing/verify-license] write failed", err);
    return NextResponse.json({ error: "Could not save the result." }, { status: 500, headers: NO_STORE });
  }

  const email = ident.email ?? session.user.email ?? ident.rootUserId;
  queueVaterEvent({
    userId: session.user.id,
    kind: "account.created",
    message: `License ${state} ${licenseNumber}: ${result.status}.`,
    data: { product: "realestate", license: { state, licenseNumber, status: result.status } },
  });

  if (result.status === "manual_review") {
    const title = `License review — ${email} (${state} ${licenseNumber})`;
    try {
      const existing = await prisma.mustCompleteItem.findFirst({ where: { title, status: "open" }, select: { id: true } });
      if (!existing) {
        const max = await prisma.mustCompleteItem.aggregate({ _max: { sortOrder: true } });
        await prisma.mustCompleteItem.create({
          data: {
            sortOrder: (max._max.sortOrder ?? 0) + 10,
            priority: "yellow",
            category: "signups",
            title,
            detail: [
              `Listing Studio user ${email} asked us to verify a ${state} real-estate license #${licenseNumber}.`,
              live ? `Registry said: ${result.reason ?? "manual review"}.` : `${state} has no live lookup wired — check the state licensing site by hand.`,
              "",
              "Resolve on /hq → Studio users → Origin / License → Verify or Reject.",
            ].join("\n"),
            links: [{ label: "HQ users", url: "/hq?tab=must" }],
            command: null,
            afterNote: null,
            source: "listing-studio",
          },
        });
      }
    } catch (err) {
      console.error("[listing/verify-license] queue write failed", err);
    }
    try {
      await notifyTelegram(
        `🏛️ Listing Studio license review: ${tgSafe(String(email))} — ${state} #${tgSafe(licenseNumber)}\n${tgSafe(result.reason ?? "")}\n\nhttps://www.tolley.io/hq`,
      );
    } catch (err) {
      console.error("[listing/verify-license] telegram failed", err);
    }
  }

  const out: VerifyLicenseResponse = {
    status: result.status,
    licenseeName: result.status === "verified" ? result.licenseeName ?? null : null,
    reason: result.reason ?? null,
  };
  return NextResponse.json(out, { headers: NO_STORE });
}
