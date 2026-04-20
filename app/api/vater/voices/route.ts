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

export async function GET() {
  try {
    const voices = await autopilot.getVoices();
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
