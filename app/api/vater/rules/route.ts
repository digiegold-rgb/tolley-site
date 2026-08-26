import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authorizeRuleRead,
  authorizeRuleWrite,
  clip,
  isGate,
  rulesVersion,
  serializeRule,
  sortRules,
} from "@/lib/vater/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The online Vater rulebook (rule 158, 2026-08-25).
 *
 * GET  ?format=pdf            → the compiled PDF (studio session; legacy view)
 * GET  [?gate=hard,planner][&includeRetired=1]
 *                             → JSON { version, count, updatedAt, sections, rules }
 *                               for the studio session OR Bearer CONTENT_API_KEY
 *                               (the DGX planner / Fable runner / audit call this
 *                               at the start of EVERY render, fail-closed).
 * POST { section, title, body, gate, source }  (studio session)
 *                             → new rule with the next permanent number.
 *
 * `version` is a content hash over ALL active rules regardless of the gate
 * filter, so every consumer stamps the same id for the same rulebook state.
 */
export async function GET(req: NextRequest) {
  const wantsPdf =
    req.nextUrl.searchParams.get("format") === "pdf" ||
    (req.headers.get("accept") ?? "").includes("application/pdf");
  const reader = await authorizeRuleRead(req);
  if (!reader.ok) return reader.response;

  if (wantsPdf) {
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

  const all = sortRules(await prisma.vaterRule.findMany());
  const active = all.filter((r) => !r.retiredAt);
  const version = rulesVersion(active);
  const includeRetired = req.nextUrl.searchParams.get("includeRetired") === "1";
  const gateParam = req.nextUrl.searchParams.get("gate");
  const gates = gateParam
    ? new Set(gateParam.split(",").map((g) => g.trim()).filter(isGate))
    : null;
  const rows = (includeRetired ? all : active).filter((r) => !gates || gates.has(r.gate as never));
  const sections = new Map<number, string>();
  for (const r of all) if (!sections.has(r.section)) sections.set(r.section, r.sectionTitle);
  const updatedAt = all.reduce<Date | null>((m, r) => (!m || r.updatedAt > m ? r.updatedAt : m), null);

  return NextResponse.json(
    {
      version,
      count: rows.length,
      updatedAt: updatedAt ? updatedAt.toISOString() : null,
      sections: [...sections.entries()].sort((a, b) => a[0] - b[0]).map(([number, title]) => ({ number, title })),
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
  const section = Number(body.section);
  const title = clip(body.title, 400)?.trim();
  if (!Number.isInteger(section) || section < 1 || !title) {
    return NextResponse.json({ error: "section (int) and title are required" }, { status: 400 });
  }
  const gate = isGate(body.gate) ? body.gate : "info";
  const sectionRow = await prisma.vaterRule.findFirst({ where: { section }, select: { sectionTitle: true } });
  const sectionTitle = clip(body.sectionTitle, 300)?.trim() || sectionRow?.sectionTitle;
  if (!sectionTitle) return NextResponse.json({ error: "new section needs a sectionTitle" }, { status: 400 });

  // Permanent numbering: next free number over the WHOLE table (rule 1 doctrine).
  const max = await prisma.vaterRule.aggregate({ _max: { number: true } });
  const number = (max._max.number ?? 0) + 1;
  const code = String(number);
  const created = await prisma.vaterRule.create({
    data: {
      code, number, suffix: "", section, sectionTitle, title,
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
