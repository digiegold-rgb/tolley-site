/**
 * GET  /api/vater/voices  → list all voice clones from the autopilot side
 * POST /api/vater/voices  → multipart upload (audio + name + sampleText)
 *
 * The autopilot is the source of truth for the voice library — this route
 * just proxies through with the bearer token added server-side. The local
 * Prisma `VaterVoiceClone` table can be kept in sync separately if needed,
 * but the source of truth is the DGX filesystem.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  autopilot,
  AutopilotError,
} from "@/lib/vater/autopilot-client";
import {
  requireVaterProxyAuth,
  requireVaterProxyRead,
} from "@/lib/vater/proxy-auth";
import { auth } from "@/auth";
import { filterVoicesForEmail } from "@/lib/vater/voice-privacy";

export async function GET(req: NextRequest) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  // Owner-private clones (Jared-A..D) never appear in a customer's picker.
  // No session = x-sync-secret caller (DGX/cron) → unfiltered.
  const session = await auth();
  const email = session?.user?.id ? (session.user.email ?? null) : undefined;
  try {
    const all = await autopilot.getVoices();
    const voices =
      email === undefined ? all : filterVoicesForEmail(all, email);
    return NextResponse.json({ voices });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Failed to list voices",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Failed to list voices",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;

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

  // Re-pack the multipart body for the upstream call. We rebuild it because
  // the incoming FormData carries the user's bearer/cookie context which we
  // don't want to propagate.
  const outForm = new FormData();
  outForm.append("audio", audio, audio.name || `${name}.wav`);
  outForm.append("name", name);
  outForm.append("sampleText", sampleText);

  try {
    const result = await autopilot.uploadVoice(outForm);
    return NextResponse.json({ voice: result }, { status: 201 });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Voice upload failed",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Voice upload failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
