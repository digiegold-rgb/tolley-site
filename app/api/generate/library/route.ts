import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import {
  buildGenerateLibraryCookie,
  clearGenerateLibraryCookie,
  isGenerateLibraryUnlocked,
  verifyGenerateLibraryPin,
} from "@/lib/generate-library-auth";
import { rateLimitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function applyLibraryCookie(
  response: NextResponse,
  cookie: ReturnType<typeof clearGenerateLibraryCookie>,
) {
  response.cookies.set(cookie.name, cookie.value, {
    maxAge: cookie.maxAge,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
  });
  return response;
}

/**
 * GET /api/generate/library — unlock status for an already-authed generate admin.
 * Unauthenticated callers get the same 401/403 as other generate admin routes
 * (no library existence leak beyond "this API is gated").
 */
export async function GET() {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;
  const unlocked = await isGenerateLibraryUnlocked(gate.createdBy);
  return NextResponse.json({ unlocked });
}

/**
 * POST /api/generate/library — verify GENERATE_LIBRARY_PIN and issue the
 * short-lived httpOnly unlock cookie, bound to this admin actor.
 */
export async function POST(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const limited = await rateLimitByIp(req, "generate:library", 5, 900);
  if (limited) return limited;

  let pin = "";
  try {
    const body = (await req.json()) as { pin?: unknown };
    pin = typeof body.pin === "string" ? body.pin.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!pin) {
    return NextResponse.json({ error: "Passcode required" }, { status: 400 });
  }
  if (!verifyGenerateLibraryPin(pin)) {
    return NextResponse.json({ error: "Invalid passcode" }, { status: 403 });
  }

  const cookie = buildGenerateLibraryCookie(gate.createdBy);
  if (!cookie) {
    return NextResponse.json(
      { error: "Library unlock is not configured (AUTH_SECRET / GENERATE_LIBRARY_PIN)." },
      { status: 503 },
    );
  }
  return applyLibraryCookie(NextResponse.json({ ok: true, unlocked: true }), cookie);
}

/** DELETE /api/generate/library — lock the library again (same session). */
export async function DELETE() {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;
  return applyLibraryCookie(
    NextResponse.json({ ok: true, unlocked: false }),
    clearGenerateLibraryCookie(),
  );
}
