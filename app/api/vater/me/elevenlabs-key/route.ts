/**
 * GET    /api/vater/me/elevenlabs-key — is MY ElevenLabs account connected?
 * PUT    /api/vater/me/elevenlabs-key — connect (or replace) my key
 * DELETE /api/vater/me/elevenlabs-key — disconnect it
 *
 * Self-serve bring-your-own-key (Jared 2026-08-17). Every Jelly Studio
 * customer — past, present and future — connects their OWN ElevenLabs account
 * here, so ElevenLabs narration bills their subscription and nobody has to
 * edit a server env file to onboard them.
 *
 * The tenant is ALWAYS `session.user.id`. The browser never names the account
 * a key is stored under, so there is no request shape that writes a key onto
 * somebody else's tenant.
 *
 * The plaintext key exists in this process for exactly one hop: it arrives in
 * the PUT body, goes to the DGX to be validated against ElevenLabs and stored
 * encrypted, and is never persisted, logged, or echoed back. GET only ever
 * returns status (`connected, ends c18c, creator tier`).
 *
 * ⚠️ Writes are blocked during an admin support session — proxy.ts 403s every
 * non-GET to /api/vater while jelly_view_as is set. Pasting a customer's key
 * on their behalf is not support.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function upstreamError(err: unknown, fallback: string) {
  if (err instanceof AutopilotError) {
    // 400 from the DGX is the user's problem (bad key) and its message is
    // written for them — pass it through instead of burying it in a 502.
    const status = err.status === 400 ? 400 : 502;
    let message = err.body || err.message;
    try {
      const parsed = JSON.parse(err.body) as { detail?: string };
      if (parsed?.detail) message = parsed.detail;
    } catch {
      /* body was not JSON — use it as-is */
    }
    return NextResponse.json({ error: message }, { status, headers: NO_STORE });
  }
  return NextResponse.json(
    { error: fallback, detail: err instanceof Error ? err.message : "unknown" },
    { status: 502, headers: NO_STORE },
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  try {
    const status = await autopilot.getUserProviderKey("elevenlabs", session.user.id);
    return NextResponse.json(status, { headers: NO_STORE });
  } catch (err) {
    return upstreamError(err, "Could not read your ElevenLabs connection");
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }

  const body = (await req.json().catch(() => ({}))) as { apiKey?: unknown };
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "Paste your ElevenLabs API key first." },
      { status: 400, headers: NO_STORE },
    );
  }
  // Cheap shape check so an obvious paste error (a voice id, a whole URL)
  // never becomes a round trip to ElevenLabs.
  if (apiKey.length < 20 || /\s/.test(apiKey)) {
    return NextResponse.json(
      {
        error:
          "That does not look like an ElevenLabs API key. Copy the whole key from " +
          "elevenlabs.io → your profile → API Keys (it starts with sk_).",
      },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const status = await autopilot.setUserProviderKey(
      "elevenlabs",
      session.user.id,
      apiKey,
    );
    return NextResponse.json(status, { headers: NO_STORE });
  } catch (err) {
    return upstreamError(err, "Could not save your ElevenLabs key");
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  try {
    const result = await autopilot.deleteUserProviderKey("elevenlabs", session.user.id);
    return NextResponse.json(
      { ...result, configured: false, provider: "elevenlabs" },
      { headers: NO_STORE },
    );
  } catch (err) {
    return upstreamError(err, "Could not disconnect your ElevenLabs key");
  }
}
