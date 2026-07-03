/**
 * FB listing-URL verification endpoint.
 *
 * GET — returns the list of fbListingIds we currently rely on for buyer
 *       deep-links. The worker fetches this, hits each URL as anonymous,
 *       and POSTs back the bad ones.
 *
 * POST — clears `fbListingId` on Products whose listing doesn't resolve to
 *        a public page. The BuyButton then falls back to Ruthann's profile
 *        URL so the customer still has a path to message her.
 *
 * Auth: HMAC-SHA256 of `<expires>.<rawBody>` (same envelope as fb-sync).
 *       For GET, body is empty so signature is over `<expires>.`.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.FB_DRAFT_SECRET;

function verify(
  rawBody: string,
  sig: string | null,
  exp: string | null
): { ok: boolean; error?: string } {
  if (!SECRET) return { ok: false, error: "secret missing" };
  if (!sig || !exp) return { ok: false, error: "headers missing" };
  const expires = parseInt(exp, 10);
  if (!Number.isFinite(expires) || Date.now() > expires) {
    return { ok: false, error: "expired or bad expires" };
  }
  const expected = createHmac("sha256", SECRET)
    .update(`${expires}.${rawBody}`)
    .digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, error: "signature mismatch" };
    }
  } catch {
    return { ok: false, error: "malformed signature" };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const verification = verify(
    "",
    req.headers.get("x-fb-mirror-signature"),
    req.headers.get("x-fb-mirror-expires")
  );
  if (!verification.ok) {
    return NextResponse.json(
      { error: "unauthorized", reason: verification.error },
      { status: 401 }
    );
  }
  // Only verify IDs attached to *visible* products. There's no point clearing
  // an ID on a sold/archived product — the BuyButton wouldn't render anyway.
  const rows = await prisma.product.findMany({
    where: {
      fbListingId: { not: null },
      status: "listed",
      listings: { some: { platform: "shop", status: "active" } },
    },
    select: { fbListingId: true },
  });
  const ids = rows
    .map((r) => r.fbListingId)
    .filter((id): id is string => typeof id === "string");
  return NextResponse.json({ ids });
}

interface BadItem {
  fbListingId: string;
  verdict: "not_available" | "login_required" | "error";
  reason: string | null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const verification = verify(
    rawBody,
    req.headers.get("x-fb-mirror-signature"),
    req.headers.get("x-fb-mirror-expires")
  );
  if (!verification.ok) {
    return NextResponse.json(
      { error: "unauthorized", reason: verification.error },
      { status: 401 }
    );
  }

  let payload: { bad?: BadItem[] };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(payload.bad)) {
    return NextResponse.json(
      { error: "bad must be an array" },
      { status: 400 }
    );
  }

  // Only clear truly-broken IDs. "error" verdicts are typically transient
  // (network blip, FB throttle) — leave those alone, they'll be retried next
  // cycle. Only `not_available` and `login_required` warrant clearing.
  const toClear = payload.bad
    .filter(
      (b) => b.verdict === "not_available" || b.verdict === "login_required"
    )
    .map((b) => b.fbListingId)
    .filter((x): x is string => typeof x === "string");

  if (toClear.length === 0) {
    return NextResponse.json({
      ok: true,
      received: payload.bad.length,
      cleared: 0,
    });
  }

  const result = await prisma.product.updateMany({
    where: { fbListingId: { in: toClear } },
    data: { fbListingId: null },
  });

  try {
    revalidatePath("/shop");
    revalidatePath("/shop/dashboard");
  } catch {
    /* best-effort */
  }

  return NextResponse.json({
    ok: true,
    received: payload.bad.length,
    cleared: result.count,
    clearedIds: toClear,
  });
}
