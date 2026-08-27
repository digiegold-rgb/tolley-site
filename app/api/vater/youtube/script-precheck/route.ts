/**
 * POST /api/vater/youtube/script-precheck
 *
 * Script Rules 2.0, rules 27 + 28 — run BEFORE a rewrite is paid for.
 *
 * Body: { text?, title?, excludeProjectId? }
 *   text  — the pasted script or imported transcript (prose pass, rule 27+28)
 *   title — checked on its own when there is no prose yet (topic pass, rule 28)
 * → { verbatim: DedupMatch[], similar: DedupMatch[], checked, inconclusive }
 *
 * Costs nothing and charges nothing: no LLM, no DGX call, no billing gate. That
 * is the entire point — the brief asks for this to run "before you spend tokens
 * on a full rewrite", so putting a paywall in front of it would defeat it.
 *
 * Scoped to the caller's own projects. Cross-tenant comparison would leak one
 * customer's script titles into another's studio, so `userId` is a hard filter,
 * never a ranking signal.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  findDuplicates,
  findTitleDuplicates,
  MIN_WORDS,
  type DedupMatch,
  type PriorScript,
} from "@/lib/vater/script-dedup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cap the history scan. Newest first — an old script he has forgotten is
 *  exactly what rule 28 is for, but 500 projects of prose is a slow request. */
const HISTORY_LIMIT = 300;
/** Guard the request body; a 2MB paste is not a script. */
const MAX_CHARS = 200_000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    text?: unknown;
    title?: unknown;
    excludeProjectId?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const text = typeof body.text === "string" ? body.text.slice(0, MAX_CHARS) : "";
  const title = typeof body.title === "string" ? body.title.slice(0, 400) : "";
  const exclude = typeof body.excludeProjectId === "string" ? body.excludeProjectId : null;
  if (!text.trim() && !title.trim()) {
    return NextResponse.json({ error: "text or title is required" }, { status: 400 });
  }

  const rows = await prisma.youTubeProject.findMany({
    where: {
      userId: session.user.id,
      ...(exclude ? { NOT: { id: exclude } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: {
      id: true,
      script: true,
      transcript: true,
      sourceTitle: true,
      topic: true,
      status: true,
      createdAt: true,
    },
  });

  const priors: PriorScript[] = rows.map((r) => ({
    id: r.id,
    // What to call it back to him. sourceTitle is what the Library card shows;
    // topic is all a topic-mode project has.
    title: (r.sourceTitle || r.topic || "Untitled project").slice(0, 200),
    // Prefer the finished script — that is what he would be duplicating. Fall
    // back to the transcript so a project that only ever got as far as import
    // still protects him.
    text: r.script || r.transcript || "",
    createdAt: r.createdAt.toISOString(),
    status: r.status,
  }));

  const prose = text.trim();
  const useProse = prose.split(/\s+/).filter(Boolean).length >= MIN_WORDS;
  const result = useProse
    ? findDuplicates(prose, priors)
    : findTitleDuplicates(title.trim(), priors);

  const verbatim: DedupMatch[] = result.matches.filter((m) => m.verdict === "verbatim");
  const similar: DedupMatch[] = result.matches.filter((m) => m.verdict === "similar");

  return NextResponse.json(
    {
      mode: useProse ? "prose" : "title",
      checked: result.checked,
      // "Nothing to compare against" is NOT "no duplicates" — the UI must say
      // which one it means, or a first-time user reads an empty result as a
      // guarantee.
      inconclusive: result.inconclusive,
      verbatim,
      similar,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
