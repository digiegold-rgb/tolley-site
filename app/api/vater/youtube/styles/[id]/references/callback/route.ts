/**
 * POST/PATCH /api/vater/youtube/styles/[id]/references/callback
 *
 * DGX worker calls this with completed transcripts. Auth via
 * Bearer CONTENT_API_KEY — NOT user session, since the autopilot has
 * no session.
 *
 * Body: { styleId, transcripts: [{ videoId, url, title, wordCount, transcript }] }
 *
 * Appends transcripts to the Style's referenceTranscripts JSON, dedup'd
 * by videoId (overwrites if same videoId arrives twice).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

interface Transcript {
  videoId?: string;
  url: string;
  title: string;
  wordCount: number;
  transcript: string;
  addedAt?: string;
}

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7).trim();
  return token === (process.env.CONTENT_API_KEY || "");
}

async function handle(req: NextRequest, ctx: Ctx) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { transcripts?: Transcript[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const incoming = (body.transcripts || []).filter(
    (t) =>
      t &&
      typeof t.url === "string" &&
      typeof t.transcript === "string" &&
      t.transcript.length > 0,
  );
  if (incoming.length === 0) {
    return NextResponse.json({ ok: true, added: 0 });
  }

  const style = await prisma.youTubeStyle.findUnique({ where: { id } });
  if (!style) {
    return NextResponse.json({ error: "Style not found" }, { status: 404 });
  }

  const existing = Array.isArray(style.referenceTranscripts)
    ? (style.referenceTranscripts as unknown as Transcript[])
    : [];
  const byKey = new Map<string, Transcript>();
  for (const t of existing) {
    byKey.set(t.videoId || t.url, t);
  }
  const now = new Date().toISOString();
  for (const t of incoming) {
    byKey.set(t.videoId || t.url, { ...t, addedAt: t.addedAt || now });
  }
  const merged = Array.from(byKey.values());

  await prisma.youTubeStyle.update({
    where: { id },
    data: { referenceTranscripts: merged as unknown as object },
  });
  return NextResponse.json({ ok: true, count: merged.length, added: incoming.length });
}

export const POST = handle;
export const PATCH = handle;
