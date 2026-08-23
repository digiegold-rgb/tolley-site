/**
 * GET /api/vater/youtube/[id]/preflight
 *
 * The render manifest behind the "Confirm before you generate" modal
 * (2026-08-20). Answers, from the server's point of view, exactly what a
 * Generate Video / Send to Fable 5 click would use: which voice, which
 * character, which art style, which soundtrack — and which of those are
 * missing or would fall back to a silent default. The modal shows this to the
 * customer and refuses to fire the paid click while `blockers` is non-empty.
 *
 * Read-only. Never creates a ticket, never starts a render.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { readEngine, isKickable, wordCount } from "@/lib/vater/concierge";
import { getStylePreset, DEFAULT_STYLE_PRESET } from "@/lib/vater/style-presets";
import { resolveOwnedLockedStyle } from "@/lib/vater/locked-style";
import { quoteMinutes } from "@/lib/vater/billing/estimate";

type Ctx = { params: Promise<{ id: string }> };

export interface PreflightBlocker {
  code:
    | "no_script"
    | "no_style"
    | "no_voice"
    | "no_art_style"
    | "no_character"
    | "no_elevenlabs_key";
  message: string;
  /** EDITOR_STEPS index the customer should be sent to, or null. */
  step: number | null;
  /** Blocks fable5, auto, or both. */
  engines: Array<"auto" | "fable5">;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    include: {
      style: { include: { characters: true, customArtStyle: true } },
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const style = project.style;
  const words = wordCount(project.script);
  const blockers: PreflightBlocker[] = [];

  // Voice: same resolution order as /context and script-gate.
  const voiceName = project.voiceName || style?.voice || null;
  if (!voiceName) {
    blockers.push({
      code: "no_voice",
      message:
        "No voice picked. Choose one in the Voiceover step — nothing should guess a voice for you.",
      step: 2,
      engines: ["auto", "fable5"],
    });
  }

  // Character: characters[0] (oldest) is the show HOST — mirror style-snapshot.
  const host = style
    ? [...style.characters].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      )[0] ?? null
    : null;
  if (!style) {
    blockers.push({
      code: "no_style",
      message:
        "No Style attached. A Style carries your character, art direction and voice — pick or build one first.",
      step: null,
      engines: ["auto", "fable5"],
    });
  } else if (!host) {
    // Fable 5 kickoff hard-asserts characters.length > 0; Auto can legally
    // render people-free b-roll, so there it is surfaced but not blocking.
    blockers.push({
      code: "no_character",
      message:
        "This Style has no character built yet. Fable 5 directs around YOUR character — build one (Styles → Characters) so every video stays the same person.",
      step: null,
      engines: ["fable5"],
    });
  }

  // Art style: /context silently falls back to the "cinematic" preset. Make
  // that fallback visible instead of silent.
  const presetId = project.stylePreset || style?.artStylePresetId || null;
  const custom = style?.customArtStyle ?? null;
  const artStyleDefaulted = !presetId && !custom;
  if (artStyleDefaulted) {
    blockers.push({
      code: "no_art_style",
      message:
        "No art style picked — the render would silently default to Cinematic. Pick one in the Visuals step.",
      step: 3,
      engines: ["auto"],
    });
  }

  // Fable 5 extra gates (min words, EL key) — same function the submit uses.
  const kick = await isKickable(project);
  if (!kick.ok && !blockers.some((b) => b.code === kick.reason)) {
    blockers.push({
      code: kick.reason,
      message: kick.message,
      step: kick.reason === "no_script" ? 1 : null,
      engines: ["fable5"],
    });
  }

  const preset = presetId ? getStylePreset(presetId) : null;

  // Canon check (2026-08-22). Not a blocker — rendering off-canon is legal —
  // but the confirm modal must SAY it, because the only visible difference
  // between "the show" and "some other style" was a card you had to recognise
  // by name. See lib/vater/locked-style.ts.
  const warnings: Array<{ code: string; message: string }> = [];
  try {
    const locked = await resolveOwnedLockedStyle(
      project.userId ?? session.user.id,
      session.user.email,
    );
    if (locked && style && style.id !== locked.id) {
      const host = locked.characterNames[0];
      warnings.push({
        code: "not_canon_style",
        message: `This is NOT your canon style ("${locked.name}") — this render will not use your locked house cast${
          host ? ` (${host})` : ""
        }. Switch the project's style if you meant to keep them.`,
      });
    }
  } catch {
    /* canon is advisory — never let it break a preflight */
  }

  return NextResponse.json({
    projectId: project.id,
    engine: readEngine(project.settingsJson),
    words,
    estMinutes: quoteMinutes(words),
    style: style ? { id: style.id, name: style.name } : null,
    voice: voiceName
      ? {
          name: voiceName,
          backend: project.voiceName && project.voiceName !== style?.voice
            ? "clone"
            : (style?.voiceBackend ?? null),
          source: project.voiceName ? "project" : "style",
        }
      : null,
    character: host
      ? {
          id: host.id,
          name: host.name,
          imageUrl: host.imageUrl,
          others: Math.max(0, (style?.characters.length ?? 1) - 1),
        }
      : null,
    artStyle: custom
      ? { kind: "custom", id: custom.id, name: custom.name, defaulted: false }
      : {
          kind: "preset",
          id: presetId ?? DEFAULT_STYLE_PRESET,
          name: preset?.name ?? (presetId ?? "Cinematic"),
          defaulted: artStyleDefaulted,
        },
    soundtrack: {
      backgroundMusicId: project.backgroundMusicId ?? null,
      musicVolume: project.musicVolume ?? null,
      sfxEnabled: project.sfxEnabled ?? false,
    },
    animUntilS: project.animUntilS ?? null,
    blockers,
    warnings,
  });
}
