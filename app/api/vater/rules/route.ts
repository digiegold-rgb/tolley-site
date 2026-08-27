import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  OWNER_SECTIONS,
  authorizeRuleRead,
  authorizeRuleWrite,
  canWriteScope,
  clip,
  isGate,
  isKind,
  isScope,
  readableScopes,
  rulesVersion,
  serializeRule,
  sortRules,
  type RuleScope,
} from "@/lib/vater/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The online rulebook (rule 158, 2026-08-25) — three scopes (see lib/vater/rules.ts).
 *
 * GET  ?format=pdf                       → the compiled house PDF (studio session)
 * GET  [?scope=global,house,owner][&owner=<userId>][&characters=<id,id>]
 *      [&gate=hard,planner][&includeRetired=1]
 *      → JSON { version, count, updatedAt, scopes, sections, rules }
 *        · API key (the DGX): any scope; `owner=` picks whose owner rules;
 *          `characters=` keeps only owner rules pinned to those characters
 *          (or to none). Default scope = global,house,owner.
 *        · studio session: default global,house,owner — owner = the session
 *          user (the `owner=` param is ignored for sessions).
 *        · any other session: global + its OWN owner rules.
 * POST { scope?, section, title, body, gate, source, characterId? }
 *      · scope global/house → studio session; next permanent number over
 *        that scope ("G<n>" / "<n>").
 *      · scope owner (default for non-studio) → any session; ownerId = the
 *        session user; number = next per owner; code "<ownerId>:<n>".
 *
 * `version` = content hash over the ACTIVE rules RETURNED (scope-aware).
 */
export async function GET(req: NextRequest) {
  const wantsPdf =
    req.nextUrl.searchParams.get("format") === "pdf" ||
    (req.headers.get("accept") ?? "").includes("application/pdf");
  const reader = await authorizeRuleRead(req);
  if (!reader.ok) return reader.response;

  if (wantsPdf) {
    if (!reader.studio) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(path.join(process.cwd(), "data", "VATER-RULES.pdf"));
    } catch {
      return NextResponse.json({ error: "Rules PDF not found" }, { status: 404 });
    }
    const download = req.nextUrl.searchParams.get("download") === "1";
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": download ? 'attachment; filename="VATER-RULES.pdf"' : "inline",
        "Cache-Control": "private, no-store",
      },
    });
  }

  const q = req.nextUrl.searchParams;
  const allowed = readableScopes(reader);
  const scopeParam = q.get("scope");
  const wanted: RuleScope[] = (scopeParam ? scopeParam.split(",").map((s) => s.trim()).filter(isScope) : allowed).filter((s) => allowed.includes(s));
  // Whose owner rules: the DGX names the owner; a session is always itself.
  const ownerId = reader.by === "dgx" ? (q.get("owner") || null) : reader.userId;
  const charParam = q.get("characters");
  const characters = charParam ? new Set(charParam.split(",").map((s) => s.trim()).filter(Boolean)) : null;

  const where: { OR: Record<string, unknown>[] } = { OR: [] };
  for (const s of wanted) {
    if (s === "owner") {
      if (ownerId) where.OR.push({ scope: "owner", ownerId });
    } else where.OR.push({ scope: s });
  }
  const rowsAll = where.OR.length ? await prisma.vaterRule.findMany({ where }) : [];
  const scoped = rowsAll.filter((r) => {
    if (r.scope !== "owner" || !characters) return true;
    return !r.characterId || characters.has(r.characterId);
  });
  const all = sortRules(scoped);
  const active = all.filter((r) => !r.retiredAt);
  const includeRetired = q.get("includeRetired") === "1";
  // kind= (video|script). Default: video only, so every existing caller —
  // scene planner, delivery audit, Fable runner, the rules PDF — keeps seeing
  // exactly the rulebook it saw before Script Rules 2.0 existed. Only a caller
  // that ASKS for script rules gets them.
  const kindParam = q.get("kind");
  const kinds = new Set<string>(
    kindParam
      ? kindParam.split(",").map((k) => k.trim()).filter(isKind)
      : ["video"],
  );
  if (kinds.size === 0) kinds.add("video");
  const gateParam = q.get("gate");
  const gates = gateParam ? new Set(gateParam.split(",").map((g) => g.trim()).filter(isGate)) : null;
  const rows = (includeRetired ? all : active)
    .filter((r) => kinds.has(r.kind))
    .filter((r) => !gates || gates.has(r.gate as never));
  // Hash only the kinds this request actually returned: a script-rule edit must
  // NOT move the version a video render stamps, and vice versa.
  const version = rulesVersion(active.filter((r) => kinds.has(r.kind)));
  const sections = new Map<string, { scope: string; number: number; title: string }>();
  for (const r of all.filter((r) => kinds.has(r.kind))) {
    const k = `${r.scope}:${r.section}`;
    if (!sections.has(k)) sections.set(k, { scope: r.scope, number: r.section, title: r.sectionTitle });
  }
  const updatedAt = all.reduce<Date | null>((m, r) => (!m || r.updatedAt > m ? r.updatedAt : m), null);

  return NextResponse.json(
    {
      version,
      count: rows.length,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
      scopes: wanted,
      ownerId,
      sections: [...sections.values()].sort((a, b) => a.scope.localeCompare(b.scope) || a.number - b.number),
      rules: rows.map(serializeRule),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const writer = await authorizeRuleWrite();
  if (!writer.ok) return writer.response;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const scope: RuleScope = isScope(body.scope) ? body.scope : writer.studio ? "house" : "owner";
  // Which bucket. Trey adds a script rule and re-runs the rewrite himself
  // (brief item 6) — no code change, no Jared.
  const kind = isKind(body.kind) ? body.kind : "video";
  const ownerId = scope === "owner" ? writer.userId : null;
  if (!canWriteScope(writer, scope, ownerId)) {
    return NextResponse.json({ error: `only studio accounts can add ${scope} rules` }, { status: 403 });
  }
  const title = clip(body.title, 400)?.trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  const gate = isGate(body.gate) ? body.gate : scope === "owner" ? "planner" : "info";

  let section = Number(body.section);
  let sectionTitle = clip(body.sectionTitle, 300)?.trim();
  if (scope === "owner") {
    const characterId = clip(body.characterId, 80)?.trim() || null;
    if (!Number.isInteger(section) || section < 1) section = characterId ? 2 : 1;
    sectionTitle = sectionTitle || OWNER_SECTIONS[section] || `Section ${section}`;
    const max = await prisma.vaterRule.aggregate({ where: { scope: "owner", ownerId: ownerId! }, _max: { number: true } });
    const number = (max._max.number ?? 0) + 1;
    const code = `${ownerId}:${number}`;
    const created = await prisma.vaterRule.create({
      data: {
        code, number, suffix: "", scope, kind, ownerId, characterId, section, sectionTitle, title,
        body: clip(body.body, 8000) ?? "",
        source: clip(body.source, 500) || null,
        gate, updatedBy: writer.email,
      },
    });
    await prisma.vaterRuleRevision.create({ data: { code, before: undefined, after: serializeRule(created), by: writer.email, note: "created" } });
    return NextResponse.json({ rule: serializeRule(created) }, { status: 201 });
  }

  if (!Number.isInteger(section) || section < 1) {
    return NextResponse.json({ error: "section (int) is required" }, { status: 400 });
  }
  const sectionRow = await prisma.vaterRule.findFirst({ where: { scope, kind, section }, select: { sectionTitle: true } });
  sectionTitle = sectionTitle || sectionRow?.sectionTitle;
  if (!sectionTitle) return NextResponse.json({ error: "new section needs a sectionTitle" }, { status: 400 });

  // Permanent numbering: next free number over the whole scope (rule 1
  // doctrine) — but per KIND, because the two buckets are numbered
  // independently. A new script rule is S29; a new video rule is 160.
  const max = await prisma.vaterRule.aggregate({ where: { scope, kind }, _max: { number: true } });
  const number = (max._max.number ?? 0) + 1;
  const code = kind === "script" ? `S${number}` : scope === "global" ? `G${number}` : String(number);
  const created = await prisma.vaterRule.create({
    data: {
      code, number, suffix: "", scope, kind, section, sectionTitle, title,
      body: clip(body.body, 8000) ?? "",
      source: clip(body.source, 500) || `${writer.email} ${new Date().toISOString().slice(0, 10)}`,
      gate, updatedBy: writer.email,
    },
  });
  await prisma.vaterRuleRevision.create({
    data: { code, before: undefined, after: serializeRule(created), by: writer.email, note: "created" },
  });
  return NextResponse.json({ rule: serializeRule(created) }, { status: 201 });
}
