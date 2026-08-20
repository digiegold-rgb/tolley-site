/**
 * GET /api/vater/social-accounts/oauth/[platform]/start?return=<route>
 *
 * Connect a platform (youtube / tiktok / instagram / facebook / pinterest /
 * twitter / linkedin) to the signed-in user's OWN account through the
 * aggregator (Zernio) — $6/month per connected account. We create the user's vendor profile lazily, ask the
 * vendor for a hosted OAuth URL and 302 the browser there. The vendor
 * handles consent + any page/board/org selection and then redirects back to
 * our /callback, which mirrors the account into SocialAccount.
 *
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ensureProfileForUser,
  getConnectUrl,
  isVendorPlatform,
  isZernioEnabled,
  ZernioError,
} from "@/lib/vater/social-vendor/zernio";
import { getBalance } from "@/lib/vater/billing/ledger";
import { hasUnmeteredStudioAccess } from "@/lib/vater/billing/check-budget";
import { SOCIAL_MONTHLY_CENTS } from "@/lib/vater/billing/social-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { platform } = await ctx.params;
  if (!isVendorPlatform(platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }
  if (!isZernioEnabled()) {
    return NextResponse.json(
      { error: "Direct connect is not enabled on this deployment yet." },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const ret = url.searchParams.get("return") || "publishing";

  // $6/month per connected account, debited from Jelly credit — refuse the
  // OAuth outright when the first cycle can't be covered, instead of letting
  // the user authorize an account we'd have to break minutes later.
  if (!(await hasUnmeteredStudioAccess(session.user.id))) {
    const balance = await getBalance(session.user.id);
    if (!balance.ready || balance.balanceCents < SOCIAL_MONTHLY_CENTS) {
      return NextResponse.redirect(
        `${url.origin}/animate?social=billing&platform=${platform}#r=${ret}`,
      );
    }
  }
  const callback = `${url.origin}/api/vater/social-accounts/oauth/${platform}/callback?return=${encodeURIComponent(ret)}`;

  try {
    const { externalProfileId } = await ensureProfileForUser(
      session.user.id,
      session.user.email,
    );
    const r = await getConnectUrl(externalProfileId, platform, callback, force);
    if (r.alreadyConnected && !r.authUrl) {
      // Nothing to authorize — just re-sync and go back.
      return NextResponse.redirect(callback);
    }
    if (!r.authUrl) {
      return NextResponse.json(
        { error: "Vendor returned no authorization URL" },
        { status: 502 },
      );
    }
    return NextResponse.redirect(r.authUrl);
  } catch (err) {
    const detail =
      err instanceof ZernioError ? err.body.slice(0, 300) : String(err);
    console.error(`[social/connect] ${platform} start failed:`, detail);
    return NextResponse.redirect(
      `${url.origin}/animate?social=error&platform=${platform}#r=${ret}`,
    );
  }
}
