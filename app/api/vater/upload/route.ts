/**
 * POST /api/vater/upload
 *
 * Two shapes, both auth-gated:
 *
 * 1. multipart/form-data with `file` — the original path, used by the style /
 *    character image pickers. Capped at 10MB for images.
 *
 * 2. application/json — the @vercel/blob CLIENT-upload handshake. The browser
 *    calls `upload()` from "@vercel/blob/client" with handleUploadUrl pointed
 *    here; the file streams browser → Blob and never touches this function.
 *    That is the ONLY way BYO narration works: a serverless request body is
 *    capped at 4.5MB on Vercel (feedback_body_size_limit), so a 50MB WAV
 *    posted as multipart would 413 long before the size check below runs.
 *    Audio only on this path, 50MB ceiling enforced by the issued token.
 */
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";

/** Images/reference art — unchanged from the original 10MB ceiling. */
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
/** BYO narration (2026-08-16) — a 20-minute WAV is ~200MB at 44.1k/16-bit
 *  stereo, but a sane MP3/compressed WAV of that length sits well under
 *  50MB. Anything bigger should be compressed before upload rather than
 *  pushed through a serverless function body. */
const AUDIO_MAX_BYTES = 50 * 1024 * 1024;

const AUDIO_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/vnd.wave",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
]);

const AUDIO_EXT = /\.(wav|mp3|m4a|aac|ogg|flac)$/i;

function isAudio(file: File): boolean {
  return AUDIO_TYPES.has(file.type.toLowerCase()) || AUDIO_EXT.test(file.name);
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth-gate: this writes a public Vercel Blob on our account. Leaving it open
  // let anyone burn storage/bandwidth by uploading arbitrary 10MB files.
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  // Client-upload handshake (large audio). Detected by content-type so the
  // five existing multipart callers are untouched.
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await request.json()) as HandleUploadBody;
    try {
      const result = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async () => ({
          // Wildcard first — browsers disagree on the exact type they report
          // for .wav/.m4a, and a mismatch here rejects the whole upload.
          allowedContentTypes: ["audio/*", ...AUDIO_TYPES],
          maximumSizeInBytes: AUDIO_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId }),
        }),
      });
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Upload failed" },
        { status: 400 },
      );
    }
  }

  const form = await request.formData();
  const file = form.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const audio = isAudio(file);
  const limit = audio ? AUDIO_MAX_BYTES : IMAGE_MAX_BYTES;
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return NextResponse.json(
      { error: `File too large (max ${mb}MB${audio ? " for audio" : ""})` },
      { status: 400 },
    );
  }

  const blob = await put(`vater/${Date.now()}-${file.name}`, file, {
    access: "public",
  });

  return NextResponse.json({ url: blob.url, pathname: blob.pathname });
}
