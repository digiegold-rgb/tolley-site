import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { wordCountForDuration } from "@/lib/vater/youtube-types";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { auth } from "@/auth";
import {
  canAccessProject,
  checkProjectAccess,
} from "@/lib/vater/project-access";
import { expireProjectIfDue } from "@/lib/vater/approval-expiry";
import { reconcileStuckDeliveries } from "@/lib/vater/delivery-verify";
import { CREATE_STEP_COUNT } from "@/lib/vater/create-steps";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Stepped flow (2026-08-28): a 7-day-old approval gate flips to `expired`
  // the moment it is read — no cron.
  let next = await expireProjectIfDue(project);
  try {
    const flipped = await reconcileStuckDeliveries({ projectId: next.id, userId: session.user.id, limit: 1 });
    if (flipped.promoted > 0) {
      next = (await prisma.youTubeProject.findUnique({ where: { id: next.id } })) ?? next;
    }
  } catch (err) {
    console.error("[vater/youtube/:id] delivery reconcile failed", err);
  }
  return NextResponse.json({ project: next });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const body = await req.json();

  const allowed = [
    "voiceId",
    "voiceName",
    "targetDuration",
    "script",
    "sourceTitle",
    "sourceChannel",
    // Stepped create flow (2026-08-28): steps 1–3 save their inputs here
    // before anything is kicked. `flowStep` = last step the user reached.
    "transcript",
    "sourceUrl",
    "flowStep",
    "customStylePrompt",
    // Publish stage (2026-08-08) — metadata staged in the Script Review
    // screen and sent verbatim to videos.insert on upload.
    "publishTitle",
    "description",
    "tags",
    "thumbnailConcept",
    // Hybrid render window: animate the first N seconds, Ken Burns the rest.
    "animUntilS",
    // Short-form promo (2026-08-09) — user-edited caption for cross-posting.
    "shortDescription",
    // Thumbnail A/B (2026-08-16) — "Use this one" on a generated variant.
    "thumbnailUrl",
    // Soundtrack (2026-08-17) — picking a music bed is a SAVE, not a render.
    // These used to be POSTed to /context, which kicks the whole creation
    // pipeline; every click on a track queued a job.
    "backgroundMusicId",
    "musicVolume",
    "sfxEnabled",
  ];
  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  // Feature settings (2026-08-16, jelly-feature-contract). `settings` is a
  // PARTIAL patch: shallow-merge over the stored bag so two editor steps
  // saving different keys in the same session don't clobber each other.
  // Explicit null on a key deletes it (back to default behavior).
  if (body.settings !== undefined) {
    if (
      body.settings === null ||
      typeof body.settings !== "object" ||
      Array.isArray(body.settings)
    ) {
      return NextResponse.json(
        { error: "settings must be an object" },
        { status: 400 },
      );
    }
    // Fable 5 Concierge (2026-08-19): `engine` and `concierge` are written
    // only by the concierge lib/routes. A customer PATCH must never flip the
    // engine or rewrite a ticket — including `null`, which would delete it.
    const settingsPatch = body.settings as Record<string, unknown>;
    if ("engine" in settingsPatch || "concierge" in settingsPatch || "scriptWriter" in settingsPatch) {
      return NextResponse.json(
        { error: "settings.engine, settings.concierge and settings.scriptWriter are server-owned" },
        { status: 400 },
      );
    }
    const existing = await prisma.youTubeProject.findUnique({
      where: { id },
      select: { settingsJson: true },
    });
    const current =
      existing?.settingsJson && typeof existing.settingsJson === "object" &&
      !Array.isArray(existing.settingsJson)
        ? (existing.settingsJson as Record<string, unknown>)
        : {};
    const merged: Record<string, unknown> = { ...current };
    for (const [key, value] of Object.entries(
      body.settings as Record<string, unknown>,
    )) {
      if (value === null) delete merged[key];
      else merged[key] = value;
    }
    data.settingsJson = merged;
  }

  // `tags` is a scalar list — a non-array would 500 inside Prisma, so
  // normalise here and surface the bad input instead.
  if (data.tags !== undefined) {
    if (!Array.isArray(data.tags)) {
      return NextResponse.json(
        { error: "tags must be an array of strings" },
        { status: 400 },
      );
    }
    data.tags = (data.tags as unknown[])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (data.musicVolume !== undefined) {
    const vol = Number(data.musicVolume);
    if (!Number.isFinite(vol)) {
      return NextResponse.json(
        { error: "musicVolume must be a number between 0 and 1" },
        { status: 400 },
      );
    }
    data.musicVolume = Math.max(0, Math.min(1, vol));
  }

  if (data.targetDuration) {
    data.targetWordCount = wordCountForDuration(data.targetDuration as number);
  }

  if (data.flowStep !== undefined) {
    const n = Number(data.flowStep);
    if (!Number.isInteger(n) || n < 1 || n > CREATE_STEP_COUNT) {
      return NextResponse.json(
        { error: `flowStep must be an integer 1..${CREATE_STEP_COUNT}` },
        { status: 400 },
      );
    }
    data.flowStep = n;
    data.flowStepAt = new Date();
  }

  if (data.transcript !== undefined) {
    if (typeof data.transcript !== "string") {
      return NextResponse.json({ error: "transcript must be a string" }, { status: 400 });
    }
    data.transcript = (data.transcript as string).slice(0, 400_000);
  }
  if (data.sourceUrl !== undefined) {
    if (data.sourceUrl !== null && typeof data.sourceUrl !== "string") {
      return NextResponse.json({ error: "sourceUrl must be a string" }, { status: 400 });
    }
    if (typeof data.sourceUrl === "string") data.sourceUrl = data.sourceUrl.slice(0, 2000);
  }

  // Version history (standing spec rule 7): every inline script save appends;
  // the no-op guard in appendScriptVersion absorbs repeat saves of the same text.
  if (typeof data.script === "string") {
    const existing = await prisma.youTubeProject.findUnique({
      where: { id },
      select: { scriptVersions: true },
    });
    data.scriptVersions = appendScriptVersion(
      existing?.scriptVersions,
      "edited",
      data.script,
    );
  }

  const project = await prisma.youTubeProject.update({
    where: { id },
    data,
  });

  return NextResponse.json({ project });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await prisma.youTubeProject.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
