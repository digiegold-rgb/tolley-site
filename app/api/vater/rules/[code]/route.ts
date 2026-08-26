import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CODE_RE,
  authorizeRuleRead,
  authorizeRuleWrite,
  canWriteScope,
  clip,
  isGate,
  readableScopes,
  serializeRule,
} from "@/lib/vater/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET one rule + its last 20 revisions (scope/owner-aware). */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const reader = await authorizeRuleRead(req);
  if (!reader.ok) return reader.response;
  const { code: raw } = await ctx.params;
  const code = decodeURIComponent(raw);
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const rule = await prisma.vaterRule.findUnique({ where: { code } });
  if (!rule) return NextResponse.json({ error: "not found" }, { status: 404 });
  const visible =
    readableScopes(reader).includes(rule.scope as never) &&
    (rule.scope !== "owner" || reader.by === "dgx" || rule.ownerId === reader.userId);
  if (!visible) return NextResponse.json({ error: "not found" }, { status: 404 });
  const revisions = await prisma.vaterRuleRevision.findMany({
    where: { code }, orderBy: { createdAt: "desc" }, take: 20,
  });
  return NextResponse.json(
    { rule: serializeRule(rule), revisions },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * PUT partial update. code / number / section / scope / ownerId are immutable
 * (permanent numbering). global + house need a studio session; an owner rule
 * only its owner. Every write records a VaterRuleRevision.
 */
export async function PUT(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const writer = await authorizeRuleWrite();
  if (!writer.ok) return writer.response;
  const { code: raw } = await ctx.params;
  const code = decodeURIComponent(raw);
  if (!CODE_RE.test(code)) return NextResponse.json({ error: "bad code" }, { status: 400 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  for (const k of ["code", "number", "section", "suffix", "scope", "ownerId"]) {
    if (k in body) return NextResponse.json({ error: `${k} is permanent and cannot be changed` }, { status: 400 });
  }
  const existing = await prisma.vaterRule.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canWriteScope(writer, existing.scope, existing.ownerId)) {
    return NextResponse.json({ error: existing.scope === "owner" ? "not your rule" : `only studio accounts can edit ${existing.scope} rules` }, { status: 403 });
  }

  const data: Record<string, unknown> = { updatedBy: writer.email };
  if ("title" in body) {
    const t = clip(body.title, 400)?.trim();
    if (!t) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    data.title = t;
  }
  if ("body" in body) data.body = clip(body.body, 8000) ?? "";
  if ("source" in body) data.source = body.source === null ? null : clip(body.source, 500) ?? existing.source;
  if ("sectionTitle" in body) {
    const st = clip(body.sectionTitle, 300)?.trim();
    if (st) data.sectionTitle = st;
  }
  if ("characterId" in body && existing.scope === "owner") {
    data.characterId = body.characterId === null ? null : clip(body.characterId, 80)?.trim() || existing.characterId;
  }
  if ("gate" in body) {
    if (!isGate(body.gate)) return NextResponse.json({ error: "gate must be hard|advisory|planner|info" }, { status: 400 });
    data.gate = body.gate;
  }
  if ("retiredAt" in body) {
    if (body.retiredAt === null || body.retiredAt === false) data.retiredAt = null;
    else if (body.retiredAt === true) data.retiredAt = new Date();
    else if (typeof body.retiredAt === "string" && !Number.isNaN(Date.parse(body.retiredAt))) data.retiredAt = new Date(body.retiredAt);
    else return NextResponse.json({ error: "retiredAt must be true/false/null/ISO date" }, { status: 400 });
  }
  if ("retiredNote" in body) data.retiredNote = body.retiredNote === null ? null : clip(body.retiredNote, 1000) ?? null;

  const updated = await prisma.vaterRule.update({ where: { code }, data });
  await prisma.vaterRuleRevision.create({
    data: {
      code, before: serializeRule(existing), after: serializeRule(updated), by: writer.email,
      note: clip(body.note, 300) ?? (data.retiredAt ? "retired" : data.retiredAt === null && existing.retiredAt ? "un-retired" : "edited"),
    },
  });
  return NextResponse.json({ rule: serializeRule(updated) });
}
