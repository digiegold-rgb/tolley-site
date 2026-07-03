/**
 * POST /api/leads/digest/verify-license — pre-checkout license validation for
 * the digest signup form.
 *
 * Body: { state: "MO" | "KS", licenseNumber: string }
 * Returns the lib/leads/license-verify result: verified (with licensee name,
 * profession, expiration) | manual_review | invalid. The signup form gates the
 * rest of the flow on this; the subscribe route re-verifies server-side so a
 * direct POST can't skip it.
 *
 * Public by design. Light per-IP throttle so the form can't be used to
 * enumerate the state registry.
 */

import { NextRequest, NextResponse } from "next/server";

import { verifyLicense, type LicenseState } from "@/lib/leads/license-verify";

export const runtime = "nodejs";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (throttled(ip)) {
    return NextResponse.json(
      { error: "Too many verification attempts — try again in a minute" },
      { status: 429 }
    );
  }

  let body: { state?: unknown; licenseNumber?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const state = body.state === "MO" || body.state === "KS" ? (body.state as LicenseState) : null;
  if (!state) {
    return NextResponse.json({ error: "state must be MO or KS" }, { status: 400 });
  }
  const licenseNumber =
    typeof body.licenseNumber === "string" ? body.licenseNumber.trim().slice(0, 30) : "";
  if (!licenseNumber) {
    return NextResponse.json({ error: "licenseNumber is required" }, { status: 400 });
  }

  const result = await verifyLicense(state, licenseNumber);
  return NextResponse.json(result);
}
