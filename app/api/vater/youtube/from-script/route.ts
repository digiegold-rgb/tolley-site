/**
 * POST /api/vater/youtube/from-script
 *
 * Script-first intake (2026-08-10, Trey). Replaces the reference-video lane
 * on the Script Review screen: Trey writes or pastes the script himself, so
 * there is nothing to download, nothing to transcribe, and no LLM scripting
 * pass to pay for.
 *
 * The row is created ALREADY PARKED at the human gate — status
 * `awaiting_script_approval` with the supplied text in `script`. No DGX call
 * happens here. The only thing that starts render spend is the existing
 * Approve & Animate click (`/[id]/approve-script`), which re-kicks
 * run-creation with the saved text as `scriptOverride`.
 *
 * Body: { script, title?, animUntilS?, styleId? }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { resolveLockedStyle, LOCKED_STYLE_NAME } from "@/lib/vater/locked-style";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import {
  WORDS_PER_MINUTE,
  isOverLength,
  lengthMessageFor,
  runtimeClock,
} from "@/lib/vater/script-limits";
import { maxWordsFor } from "@/lib/vater/billing/script-cap";

/** Guard rails on the pasted text: enough to be a script, small enough that a
 *  paste accident can't push a novel through the renderer. */
const MIN_WORDS = 20;
const MAX_CHARS = 200_000;

interface CreateBody {
  script?: string;
  title?: string;
  /** Animate the first N seconds; the remainder runs as Ken Burns stills. */
  animUntilS?: number;
  /** Escape hatch — normally omitted so the locked style is used. */
  styleId?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const script = typeof body.script === "string" ? body.script.trim() : "";
  if (!script) {
    return NextResponse.json(
      { error: "Paste or upload a script first" },
      { status: 400 },
    );
  }
  if (script.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Script is too long (${script.length} characters, max ${MAX_CHARS})` },
      { status: 400 },
    );
  }
  const wordCount = script.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_WORDS) {
    return NextResponse.json(
      { error: `Script is only ${wordCount} words — need at least ${MIN_WORDS}` },
      { status: 400 },
    );
  }
  // Runtime cap. Stop it here rather than at the render gate: the DGX rejects
  // an over-cap script anyway (vater.py run-creation), and finding out at
  // Approve & Animate means the user has already invested in the project.
  //
  // Tier-aware (lib/vater/billing/script-cap.ts): the owner is uncapped, an
  // account with purchased credit gets ~20:00, everyone else ~9:00.
  const maxWords = await maxWordsFor(session.user.id, session.user.email);
  if (isOverLength(wordCount, maxWords)) {
    const message = lengthMessageFor(maxWords);
    return NextResponse.json(
      {
        error: "script_too_long",
        message,
        detail: `That script is ${wordCount.toLocaleString()} words (≈ ${runtimeClock(wordCount)}). ${message}`,
        wordCount,
        maxWords,
      },
      { status: 400 },
    );
  }

  const title =
    (typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : firstLineAsTitle(script)
    ).slice(0, 200);

  // Style: the locked bundle unless a caller explicitly overrides. An
  // override still has to be a row we're allowed to use — same rule as the
  // reference lane, so a bad id is an error, never a styleless project that
  // silently renders in some other look.
  let styleId: string;
  if (body.styleId) {
    const style = await prisma.youTubeStyle.findUnique({
      where: { id: body.styleId },
      select: { id: true, userId: true, isSystem: true },
    });
    if (!style) {
      return NextResponse.json({ error: "Style not found" }, { status: 404 });
    }
    if (!style.isSystem && style.userId && style.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    styleId = style.id;
  } else {
    const locked = await resolveLockedStyle(session.user.id);
    if (!locked) {
      return NextResponse.json(
        {
          error: `No “${LOCKED_STYLE_NAME}” style on this account — create it in Styles before rendering.`,
        },
        { status: 409 },
      );
    }
    // Safety net: with VATER_LOCKED_STYLE_ID pinned, resolveLockedStyle()
    // returns Trey's row for ANY caller. A public customer must never
    // silently render in someone else's locked look — make them pick or
    // create their own style instead. (Pipeline logic is untouched; this is
    // an authorization check on the resolved row.)
    if (!isVaterStudioEmail(session.user.email)) {
      const owner = await prisma.youTubeStyle.findUnique({
        where: { id: locked.id },
        select: { userId: true, isSystem: true },
      });
      if (owner && !owner.isSystem && owner.userId && owner.userId !== session.user.id) {
        return NextResponse.json(
          {
            error: "no_locked_style",
            message:
              "Pick or create a style before rendering — this account has no locked style.",
          },
          { status: 409 },
        );
      }
    }
    styleId = locked.id;
  }

  const animUntilS =
    typeof body.animUntilS === "number" && body.animUntilS > 0
      ? Math.round(body.animUntilS)
      : null;

  // `targetDuration` is minutes and drives nothing at render time now that the
  // script is fixed — it's the Library/estimate figure. Round up so a 40s
  // script doesn't display as a zero-minute video.
  const targetDuration = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

  const project = await prisma.youTubeProject.create({
    data: {
      userId: session.user.id,
      // No transcript exists, so the DGX runs the topic path with the script
      // supplied verbatim as scriptOverride — principles + scripting are
      // skipped entirely.
      mode: "topic",
      sourceType: "topic",
      topic: title,
      sourceTitle: title,
      goal: title,
      script,
      scriptVersions: appendScriptVersion(null, "edited", script),
      scriptMeta: {
        wordCount,
        targetWordCount: wordCount,
        source: "user-supplied",
      },
      targetDuration,
      targetWordCount: wordCount,
      styleId,
      animUntilS,
      // Straight to the human gate. Nothing has been spent and nothing will
      // be until Approve & Animate.
      status: "awaiting_script_approval",
      progress: 25,
    },
  });

  console.log(
    `[vater/from-script] project=${project.id} — ${wordCount} words parked at the approval gate (style=${styleId})`,
  );
  return NextResponse.json({ project }, { status: 201 });
}

/** Title from the script's first non-empty line when the user didn't name it. */
function firstLineAsTitle(script: string): string {
  const line = script
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  if (!line) return "Untitled script";
  const words = line.split(/\s+/);
  return words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : line;
}
