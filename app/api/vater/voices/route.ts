/**
 * GET  /api/vater/voices  → the caller's voice catalog
 * POST /api/vater/voices  → multipart upload (audio + name + sampleText)
 *
 * The autopilot is the source of truth for the voice library — this route
 * proxies through with the bearer token added server-side.
 *
 * Per-user namespaces (Phase 3, 2026-08-15). The DGX library used to be one
 * flat directory that every signed-in account could read and write, so:
 *   - GET now asks the DGX for `shared + u_<userId>` (owner account: `all`),
 *     and re-filters the answer here so a DGX change can't widen the blast
 *     radius on its own.
 *   - POST is open to every signed-in user (cloning your own voice is no
 *     longer studio-only), capped at MAX_OWN_VOICES_DEFAULT own clones for
 *     non-studio tiers, and requires a consent attestation that is filed on
 *     the DGX beside the clip as `<Name>.consent.json` (Terms §9).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import { requireVaterProxyRead } from "@/lib/vater/proxy-auth";
import { auth } from "@/auth";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import {
  filterVoicesForCaller,
  filterVoicesForEmail,
  ownerKeyForUser,
  splitVoiceId,
  MAX_OWN_VOICES_DEFAULT,
} from "@/lib/vater/voice-privacy";

/** Consent shapes the Terms recognise. Anything else is rejected. */
const CONSENT_TYPES = new Set(["own", "written-consent"]);

export async function GET(req: NextRequest) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;

  // No session = x-sync-secret caller (DGX/cron) → unfiltered shared library,
  // exactly as before.
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = userId ? (session?.user?.email ?? null) : undefined;

  try {
    if (email === undefined) {
      return NextResponse.json({ voices: await autopilot.getVoices() });
    }
    const isOwner = isVaterAdminEmail(email);
    const ownerKey = ownerKeyForUser(userId!);
    const all = await autopilot.getVoices(isOwner ? "all" : ownerKey);
    // Belt and braces: the DGX already scoped the query, and we scope the
    // answer again so a stale/over-broad upstream can't leak another tenant.
    const voices = isOwner
      ? filterVoicesForEmail(all, email)
      : filterVoicesForCaller(all, { userId, email });
    return NextResponse.json({ voices, ownerKey });
  } catch (err) {
    return upstreamFailure(err, "Failed to list voices");
  }
}

export async function POST(req: NextRequest) {
  // Cloning your own voice is a product feature for every tier now, not a
  // studio perk — but it is still a signed-in action, and each upload is
  // written into the caller's own namespace only.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const email = session.user.email ?? null;
  const ownerKey = ownerKeyForUser(userId);
  const unlimited = isVaterStudioEmail(email); // studio + owner

  let inForm: FormData;
  try {
    inForm = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart body" },
      { status: 400 },
    );
  }

  const audio = inForm.get("audio");
  const name = inForm.get("name");
  const sampleText = inForm.get("sampleText");
  const voiceConsent = inForm.get("voiceConsent");

  if (!(audio instanceof File)) {
    return NextResponse.json(
      { error: "audio file is required" },
      { status: 400 },
    );
  }
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!sampleText || typeof sampleText !== "string") {
    return NextResponse.json(
      { error: "sampleText is required" },
      { status: 400 },
    );
  }
  // Consent is not a checkbox we can skip: it is the record that says whose
  // voice this is, and it is the only defence when someone reports a clone.
  if (typeof voiceConsent !== "string" || !CONSENT_TYPES.has(voiceConsent)) {
    return NextResponse.json(
      {
        error:
          "Confirm whose voice this is before uploading — your own, or someone who gave you written consent.",
        field: "voiceConsent",
      },
      { status: 400 },
    );
  }

  try {
    // Beta cap: count only clones already in this caller's namespace.
    if (!unlimited) {
      const mine = (await autopilot.getVoices(ownerKey)).filter(
        (v) => splitVoiceId(v?.name).owner === ownerKey,
      );
      const replacing = mine.some(
        (v) => splitVoiceId(v?.name).stem === name.trim().replace(/[^A-Za-z0-9_-]/g, ""),
      );
      if (!replacing && mine.length >= MAX_OWN_VOICES_DEFAULT) {
        return NextResponse.json(
          {
            error: `Beta limit is ${MAX_OWN_VOICES_DEFAULT} custom voices per account. Delete one to add another.`,
            limit: MAX_OWN_VOICES_DEFAULT,
            used: mine.length,
          },
          { status: 409 },
        );
      }
    }

    // Re-pack the multipart body for the upstream call. We rebuild it because
    // the incoming FormData carries the user's bearer/cookie context which we
    // don't want to propagate — and because ownerKey must come from the
    // session, never from the client.
    const outForm = new FormData();
    outForm.append("audio", audio, audio.name || `${name}.wav`);
    outForm.append("name", name);
    outForm.append("sampleText", sampleText);
    outForm.append("ownerKey", ownerKey);
    outForm.append("voiceConsent", voiceConsent);
    outForm.append("consentUserId", userId);

    const result = await autopilot.uploadVoice(outForm);
    return NextResponse.json({ voice: result }, { status: 201 });
  } catch (err) {
    return upstreamFailure(err, "Voice upload failed");
  }
}

function upstreamFailure(err: unknown, what: string) {
  if (err instanceof AutopilotError) {
    return NextResponse.json(
      { error: what, status: err.status, detail: err.body || err.message },
      { status: 502 },
    );
  }
  return NextResponse.json(
    { error: what, detail: err instanceof Error ? err.message : "unknown" },
    { status: 502 },
  );
}
