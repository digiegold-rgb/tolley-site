/**
 * POST /api/vater/concierge/[ticket]/scenes
 *   body {scenes:[{idx, version?, imagePrompt?, startS?, endS?}], captionTimings?}  (no version = timing-only)
 *
 * Records the operator's authored repairs on the project row after the DGX
 * regen wrote `scenes/NNN_vN.png` into the job work dir. Idx-keyed MERGE
 * into `scenesJson` — untouched scenes keep every field. A patched idx gets
 * the versioned proxy `imageUrl`, the new `version`, and — exactly like the
 * editor's regen route — loses any prior animation (`mediaType:'image'`,
 * `videoUrl` cleared, `videoVersion:0`, `animate:false`) because the old
 * clip no longer matches the new still. `captionTimings` replaces the
 * column wholesale when given (beat-snap re-timing).
 *
 * `idx` is 0-BASED here (the scenesJson index); the CLI converts from the
 * operator's 1-based scene numbers.
 *
 * → 200 {patched:[idx], sceneCount, captionTimingsReplaced}
 * · 400 bad body / idx out of range  · 409 {code:"no_scenes"} (sync first)
 */
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";

import { actorLabel, authorizeConcierge } from "@/lib/vater/concierge-auth";
import { writeConcierge } from "@/lib/vater/concierge";
import { jsonError, loadTicketProject, readBody } from "@/lib/vater/concierge-operator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ ticket: string }> };

interface ScenePatch {
  idx: number;
  /** Absent = timing-only row (beat-snap neighbour): startS/endS move, media untouched. */
  version?: number;
  imagePrompt?: string;
  startS?: number;
  endS?: number;
}

interface ScenesBody {
  scenes?: unknown;
  captionTimings?: unknown;
  by?: unknown;
}

function parsePatches(raw: unknown): ScenePatch[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "scenes must be a non-empty array";
  const out: ScenePatch[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return "each scene must be an object";
    const s = item as Record<string, unknown>;
    if (!Number.isInteger(s.idx) || (s.idx as number) < 0) return "scene.idx must be a non-negative integer";
    const p: ScenePatch = { idx: s.idx as number };
    if (s.version !== undefined && s.version !== null) {
      if (!Number.isInteger(s.version) || (s.version as number) < 0) return "scene.version must be a non-negative integer";
      p.version = s.version as number;
    }
    if (s.imagePrompt !== undefined) {
      if (typeof s.imagePrompt !== "string") return "scene.imagePrompt must be a string";
      p.imagePrompt = s.imagePrompt;
    }
    if (s.startS !== undefined) {
      if (typeof s.startS !== "number" || !Number.isFinite(s.startS) || s.startS < 0) return "scene.startS must be a number ≥ 0";
      p.startS = s.startS;
    }
    if (s.endS !== undefined) {
      if (typeof s.endS !== "number" || !Number.isFinite(s.endS) || s.endS < 0) return "scene.endS must be a number ≥ 0";
      p.endS = s.endS;
    }
    if (p.startS !== undefined && p.endS !== undefined && p.endS <= p.startS) return `scene ${p.idx}: endS must be > startS`;
    out.push(p);
  }
  return out;
}

function validCaptions(raw: unknown): boolean {
  return (
    Array.isArray(raw) &&
    raw.every(
      (w) =>
        w &&
        typeof w === "object" &&
        typeof (w as { word?: unknown }).word === "string" &&
        typeof (w as { start?: unknown }).start === "number" &&
        typeof (w as { end?: unknown }).end === "number",
    )
  );
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await authorizeConcierge(req);
  if (!auth.ok) return auth.response;

  const body = await readBody<ScenesBody>(req);
  if (!body) return jsonError(400, "Invalid JSON body");
  const patches = parsePatches(body.scenes);
  if (typeof patches === "string") return jsonError(400, patches, { code: "bad_body" });
  if (body.captionTimings !== undefined && !validCaptions(body.captionTimings)) {
    return jsonError(400, "captionTimings must be [{word,start,end}]", { code: "bad_body" });
  }

  const { ticket: param } = await ctx.params;
  const loaded = await loadTicketProject(param);
  if ("response" in loaded) return loaded.response;
  const { project, ticket } = loaded;

  if (ticket.stage === "delivered" || ticket.stage === "cancelled") {
    return jsonError(409, `ticket is ${ticket.stage} — terminal`, { code: "terminal", stage: ticket.stage });
  }

  const scenes: Array<Record<string, unknown>> = Array.isArray(project.scenesJson)
    ? (project.scenesJson as Array<Record<string, unknown>>).map((s) => ({ ...(s ?? {}) }))
    : [];
  if (scenes.length === 0) {
    return jsonError(409, "project has no scenesJson yet — run sync first", { code: "no_scenes" });
  }
  for (const p of patches) {
    if (p.idx >= scenes.length) {
      return jsonError(400, `scene idx ${p.idx} out of range (have ${scenes.length} scenes)`, {
        code: "idx_out_of_range",
        sceneCount: scenes.length,
      });
    }
  }

  const patched: number[] = [];
  for (const p of patches) {
    const existing = scenes[p.idx];
    const timingOnly = p.version === undefined;
    scenes[p.idx] = {
      ...existing,
      idx: p.idx,
      ...(p.startS !== undefined ? { startS: p.startS } : {}),
      ...(p.endS !== undefined ? { endS: p.endS } : {}),
      // Timing-only rows (beat-snap neighbours) keep their media — they may be
      // animated clips. Only a re-rolled still (row carries `version`) swaps the
      // image and invalidates any animation made from the old one.
      ...(timingOnly
        ? {}
        : {
            imageUrl: `/api/vater/youtube/${project.id}/scene/${p.idx}?v=${p.version}`,
            version: p.version,
            ...(p.imagePrompt !== undefined ? { imagePrompt: p.imagePrompt } : {}),
            mediaType: "image",
            videoUrl: undefined,
            videoVersion: 0,
            animate: false,
          }),
    };
    patched.push(p.idx);
  }

  const by = actorLabel(auth.by, body.by);
  const captionsReplaced = body.captionTimings !== undefined;
  await writeConcierge(
    project.id,
    {},
    {
      by,
      historyNote: `scenes patched: ${patched.map((i) => i + 1).join(", ")}${captionsReplaced ? " + captions re-timed" : ""}`,
      extraData: {
        scenesJson: scenes as unknown as Prisma.InputJsonValue,
        ...(captionsReplaced ? { captionTimings: body.captionTimings as Prisma.InputJsonValue } : {}),
        editedAt: new Date(),
      },
    },
  );
  // Scene proxy URLs are cached per project — bust so the editor sees v=N.
  revalidateTag("vater-youtube-project", "max");

  return NextResponse.json({ patched, sceneCount: scenes.length, captionTimingsReplaced: captionsReplaced });
}
