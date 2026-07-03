import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const STUDIO_API = process.env.STUDIO_API_URL || "https://studio-api.tolley.io";
const STUDIO_KEY = process.env.STUDIO_API_KEY || "creator-studio-2026";

const NARRATION_COST = 1;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase());
}

export const maxDuration = 120;

/** POST /api/video/narrate
 *  Generates F5-TTS narration via studio-api, persists to Vercel Blob.
 *  Body: { text, voice, speed?, videoGenerationId? }
 *  Response: { ok, audioUrl, voice, durationSecs?, generationId? }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    text?: string;
    voice?: string;
    speed?: number;
    videoGenerationId?: string;
  };

  const text = (body.text || "").trim();
  const voice = body.voice || "Sophie_Anderson";
  const speed = typeof body.speed === "number" ? body.speed : 1.0;

  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "text too long (max 4000 chars)" }, { status: 400 });
  }

  const admin = isAdmin(session.user.email);

  // Credit check (admin bypass)
  if (!admin) {
    const credit = await prisma.videoCredit.findUnique({
      where: { userId: session.user.id },
    });
    if (!credit || credit.balance < NARRATION_COST) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: NARRATION_COST,
          balance: credit?.balance ?? 0,
        },
        { status: 402 },
      );
    }
  }

  // Call studio-api /generate-narration (blocking, ~5-30s)
  let studioResult: { audioUrl?: string; filename?: string; promptId?: string };
  try {
    const studioResp = await fetch(`${STUDIO_API}/generate-narration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Studio-Key": STUDIO_KEY,
      },
      body: JSON.stringify({ text, voice, speed, timeoutS: 90 }),
    });

    if (!studioResp.ok) {
      const errBody = await studioResp.text();
      return NextResponse.json(
        { error: "Narration generation failed", upstream: errBody.slice(0, 500) },
        { status: 502 },
      );
    }
    studioResult = await studioResp.json();
  } catch (e) {
    return NextResponse.json(
      { error: "Studio API unreachable", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }

  if (!studioResult.audioUrl) {
    return NextResponse.json({ error: "No audio returned" }, { status: 502 });
  }

  // Build absolute URL for the audio file on studio-api
  const absoluteAudioUrl = studioResult.audioUrl.startsWith("http")
    ? studioResult.audioUrl
    : `${STUDIO_API}${studioResult.audioUrl}`;

  // Persist audio to Vercel Blob for permanent storage
  let blobUrl: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const audioRes = await fetch(absoluteAudioUrl);
      if (audioRes.ok) {
        const ext = (studioResult.filename || "").split(".").pop()?.toLowerCase() || "wav";
        const ct =
          ext === "flac" ? "audio/flac" :
          ext === "mp3"  ? "audio/mpeg" :
          ext === "ogg"  ? "audio/ogg"  :
          "audio/wav";
        const filename = `narrations/${session.user.id}/${Date.now()}-${voice}.${ext}`;
        const blob = await put(filename, audioRes.body!, {
          access: "public",
          contentType: ct,
          addRandomSuffix: false,
        });
        blobUrl = blob.url;
      }
    } catch {
      // Fall through — return the studio-api URL if blob persist fails
    }
  }

  const finalUrl = blobUrl || absoluteAudioUrl;

  // Optionally attach to a VideoGeneration row
  let attached = false;
  if (body.videoGenerationId) {
    try {
      const gen = await prisma.videoGeneration.findFirst({
        where: { id: body.videoGenerationId, userId: session.user.id },
      });
      if (gen) {
        await prisma.videoGeneration.update({
          where: { id: gen.id },
          data: {
            narrationText: text,
            narrationVoiceId: voice,
            narrationBlobUrl: finalUrl,
          },
        });
        attached = true;
      }
    } catch {
      // narration columns may not exist yet (pending db push) — degrade gracefully
    }
  }

  // Deduct credit (after success only)
  if (!admin) {
    try {
      await prisma.videoCredit.update({
        where: { userId: session.user.id },
        data: {
          balance: { decrement: NARRATION_COST },
          totalUsed: { increment: NARRATION_COST },
        },
      });
    } catch {
      // shouldn't happen — checked above
    }
  }

  const updatedCredit = !admin
    ? await prisma.videoCredit.findUnique({
        where: { userId: session.user.id },
        select: { balance: true },
      })
    : null;

  return NextResponse.json({
    ok: true,
    audioUrl: finalUrl,
    voice,
    promptId: studioResult.promptId,
    attached,
    creditsUsed: admin ? 0 : NARRATION_COST,
    creditsRemaining: admin ? Infinity : updatedCredit?.balance ?? 0,
  });
}
