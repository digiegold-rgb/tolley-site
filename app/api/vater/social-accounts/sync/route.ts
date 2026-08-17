/**
 * POST /api/vater/social-accounts/sync
 *
 * Re-mirror the caller's vendor (Zernio) accounts into SocialAccount rows.
 * The Publishing screen calls this on load so a token the user revoked on
 * the platform side shows as "reconnect" instead of silently failing at
 * publish time. Cheap: one vendor GET.
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  isZernioEnabled,
  syncAccountsForUser,
  ZernioError,
} from "@/lib/vater/social-vendor/zernio";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isZernioEnabled()) {
    return NextResponse.json({ ok: true, vendor: null, platforms: [] });
  }
  try {
    const platforms = await syncAccountsForUser(session.user.id);
    return NextResponse.json({ ok: true, vendor: "zernio", platforms });
  } catch (err) {
    const detail =
      err instanceof ZernioError ? err.body.slice(0, 300) : String(err);
    return NextResponse.json({ ok: false, error: detail }, { status: 502 });
  }
}
