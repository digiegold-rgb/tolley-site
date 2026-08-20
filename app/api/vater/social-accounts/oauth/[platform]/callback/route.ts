/**
 * GET /api/vater/social-accounts/oauth/[platform]/callback?return=<route>
 *
 * Landing page after the vendor-hosted OAuth. There is no code exchange to
 * do here — the vendor already holds the token. We simply re-sync the
 * user's vendor accounts into SocialAccount rows and bounce back into
 * /animate on the Publishing screen with a status flag.
 *
 * Auth: session cookie (the user never left our origin cookie-wise).
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isVendorPlatform,
  syncAccountsForUser,
} from "@/lib/vater/social-vendor/zernio";
import { notifyTelegram } from "@/lib/budget/notify";
import { chargeConnectCycle } from "@/lib/vater/billing/social-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

const SAFE_RETURN = /^[a-z0-9-]{1,40}$/i;

export async function GET(request: Request, ctx: Ctx) {
  const url = new URL(request.url);
  const retRaw = url.searchParams.get("return") || "publishing";
  const ret = SAFE_RETURN.test(retRaw) ? retRaw : "publishing";
  const { platform } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${url.origin}/animate?social=signin#r=${ret}`);
  }
  if (!isVendorPlatform(platform)) {
    return NextResponse.redirect(`${url.origin}/animate?social=error#r=${ret}`);
  }
  let connected = false;
  try {
    const platforms = await syncAccountsForUser(session.user.id);
    connected = platforms.includes(platform);
  } catch (err) {
    console.error(`[social/connect] ${platform} sync failed:`, err);
  }
  if (connected) {
    // First $6 cycle lands NOW (idempotent per row+cycle). If the balance was
    // spent mid-OAuth the link is broken again immediately — the house never
    // carries an unpaid vendor account.
    let charge = "uncharged";
    try {
      charge = await chargeConnectCycle(session.user.id, platform);
    } catch (err) {
      console.error(`[social/connect] cycle-0 charge failed for ${platform}:`, err);
    }
    if (charge === "insufficient") {
      return NextResponse.redirect(
        `${url.origin}/animate?social=billing&platform=${platform}#r=${ret}`,
      );
    }
    // Jared needs to SEE every connection land, not discover it on the
    // Zernio invoice. Best-effort.
    void notifyTelegram(
      `🔌 /animate social connect: ${session.user.email ?? session.user.id} connected ${platform} — $6/mo cycle 1 ${charge === "charged" ? "debited" : charge}.`,
    ).catch(() => undefined);
  }
  const flag = connected ? "connected" : "pending";
  return NextResponse.redirect(
    `${url.origin}/animate?social=${flag}&platform=${platform}#r=${ret}`,
  );
}
