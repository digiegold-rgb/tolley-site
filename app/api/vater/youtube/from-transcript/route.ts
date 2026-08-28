/**
 * POST /api/vater/youtube/from-transcript
 *
 * Rewrite a source we ALREADY HAVE THE WORDS FOR.
 *
 * Jared 2026-08-27: "If I select I want the video to be 6 min it needs to
 * prompt me to transcribe and rewrite — but why does it need to transcribe
 * when there is already the verbatim words from the video???"
 *
 * He is right, and the old shape was indefensible. "Get the text" pulls a
 * YouTube caption track for free in about two seconds. The only rewrite path
 * then re-downloaded the same video's audio and ran whisper over it to
 * reproduce words already sitting in the textarea — minutes of GPU and a
 * transcription charge to learn nothing.
 *
 * This route skips all of it: the transcript goes straight onto the row, the
 * project opens at `transcribed`, and the writer rewrites it under the house
 * script rules (S1..S28) with `stopAfterScript` so it parks at the approval
 * gate. Nothing is voiced, nothing is rendered.
 *
 * Cost: the script generation only. No transcription line, because no
 * transcription happened.
 *
 * `POST /api/vater/youtube { url }` (yt-dlp + whisper) remains the fallback
 * for the videos that genuinely have no caption track — see
 * `_youtube_transcript_text` in vater.py, which tries the cache, then
 * youtube_transcript_api, then yt-dlp's auto-subs, and only then gives up.
 *
 * Body: { transcript, title?, sourceUrl?, targetDuration?, animUntilS?, styleId? }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { WORDS_PER_MINUTE, wordCountForDuration } from "@/lib/vater/youtube-types";
import { resolveLockedStyle, LOCKED_STYLE_NAME } from "@/lib/vater/locked-style";
import { isVaterStudioEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Below this a "transcript" is a stray paste, not something to rewrite. */
const MIN_WORDS = 40;
const MAX_CHARS = 400_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    transcript?: unknown;
    title?: unknown;
    sourceUrl?: unknown;
    targetDuration?: unknown;
    animUntilS?: unknown;
    styleId?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const transcript =
    typeof body.transcript === "string" ? body.transcript.slice(0, MAX_CHARS).trim() : "";
  const sourceWords = transcript.split(/\s+/).filter(Boolean).length;
  if (sourceWords < MIN_WORDS) {
    return NextResponse.json(
      { error: `That is only ${sourceWords} words — import the source first.` },
      { status: 400 },
    );
  }

  // Script rule 1: default to the SOURCE's own length. A target only overrides
  // it when the customer actually moved the slider.
  const requested = Number(body.targetDuration);
  const targetDuration =
    Number.isFinite(requested) && requested > 0
      ? Math.min(60, Math.round(requested))
      : Math.max(1, Math.ceil(sourceWords / WORDS_PER_MINUTE));
  const targetWordCount = wordCountForDuration(targetDuration);

  const animUntilS =
    typeof body.animUntilS === "number" && body.animUntilS > 0
      ? Math.round(body.animUntilS)
      : null;

  // Only the script is bought here. Gate on that, not on "transcription" —
  // quoting a transcription the customer is not about to pay for is how a
  // budget wall appears for a charge that never happens.
  const budget = await checkBudget(session.user.id, "script");
  if (!budget.allow) {
    return NextResponse.json({ error: "Billing check failed", budget }, { status: 402 });
  }

  // Style resolution mirrors /from-script deliberately, INCLUDING its
  // authorization check: with VATER_LOCKED_STYLE_ID pinned, resolveLockedStyle
  // returns Trey's row for any caller, so a public customer must never end up
  // silently rendering in someone else's locked look.
  let styleId: string;
  if (typeof body.styleId === "string" && body.styleId) {
    const style = await prisma.youTubeStyle.findUnique({
      where: { id: body.styleId },
      select: { id: true, userId: true, isSystem: true },
    });
    if (!style) return NextResponse.json({ error: "Style not found" }, { status: 404 });
    if (!style.isSystem && style.userId && style.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    styleId = style.id;
  } else {
    const locked = await resolveLockedStyle(session.user.id);
    if (!locked) {
      return NextResponse.json(
        { error: `No \u201c${LOCKED_STYLE_NAME}\u201d style on this account — create it in Styles first.` },
        { status: 409 },
      );
    }
    if (!isVaterStudioEmail(session.user.email)) {
      const owner = await prisma.youTubeStyle.findUnique({
        where: { id: locked.id },
        select: { userId: true, isSystem: true },
      });
      if (owner && !owner.isSystem && owner.userId && owner.userId !== session.user.id) {
        return NextResponse.json(
          {
            error: "no_locked_style",
            message: "Pick or create a style before rendering — this account has no locked style.",
          },
          { status: 409 },
        );
      }
    }
    styleId = locked.id;
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : transcript.slice(0, 80);

  const project = await prisma.youTubeProject.create({
    data: {
      userId: session.user.id,
      // transcribe mode with the transcript already in hand: the pipeline's
      // fetch + whisper stages have nothing left to do, so the writer is the
      // first thing that runs.
      mode: "transcribe",
      sourceType: "manual",
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl.slice(0, 2000) : null,
      sourceTitle: title,
      transcript,
      transcriptMeta: {
        words: sourceWords,
        via: "caption-track",
        note: "imported free via /api/vater/script/from-url — no whisper, no transcription charge",
      },
      targetDuration,
      targetWordCount,
      styleId,
      animUntilS,
      status: "transcribed",
      progress: 20,
    },
  });

  // Kick the writer immediately and STOP at the script. This is the step that
  // /script-from-reference was written for and that nothing in the UI ever
  // called, which is why a transcribed project used to sit there forever.
  try {
    const jobId = await startRunCreation(project, { stopAfterScript: true });
    const withJob = await prisma.youTubeProject.update({
      where: { id: project.id },
      data: { autopilotJobId: jobId, status: "scripting", progress: 25 },
    });
    console.log(
      `[vater/from-transcript] project=${project.id} job=${jobId} — ${sourceWords} words in, ` +
        `${targetWordCount} target, rewriting under the house script rules`,
    );
    return NextResponse.json({ project: withJob }, { status: 201 });
  } catch (err) {
    // ScriptGateError is the customer's to fix — most often "this style has no
    // voice". That is a 409 with something actionable in it, not a 502 that
    // reads like our box fell over. AutopilotError (and anything else) IS our
    // problem, and stays a 502.
    const gate = err instanceof ScriptGateError;
    const detail =
      gate || err instanceof AutopilotError
        ? err.message
        : err instanceof Error
          ? err.message
          : "unknown error";
    // Keep the row — the transcript is worth something and the customer can
    // retry from the review screen. Surface WHY rather than a bare 500.
    await prisma.youTubeProject.update({
      where: { id: project.id },
      data: { status: "transcribed", progress: 20, errorMessage: detail },
    });
    return NextResponse.json(
      {
        error: gate ? detail : "Could not start the rewrite",
        detail,
        project,
      },
      { status: gate ? 409 : 502 },
    );
  }
}
