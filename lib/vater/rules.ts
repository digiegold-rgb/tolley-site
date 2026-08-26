/**
 * Online Vater rulebook — shared helpers for /api/vater/rules.
 *
 * The rulebook (VaterRule) is the source of truth for the numbered production
 * rules (2026-08-25, rule 158). Every render on the DGX (scene planner, Fable
 * runner, delivery audit) fetches it and records `version` — a content hash
 * over ALL active rules, independent of any gate filter, so a planner that
 * fetched `gate=planner,hard` and an audit that fetched everything agree on
 * what "the rulebook" was at that moment.
 */
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";
import type { VaterRule } from "@prisma/client";

export const RULE_GATES = ["hard", "advisory", "planner", "info"] as const;
export type RuleGate = (typeof RULE_GATES)[number];

export type RuleReader =
  | { ok: true; by: "dgx" | "studio"; email: string | null }
  | { ok: false; response: NextResponse };

/** Bearer CONTENT_API_KEY (constant-time) OR a studio-allowlisted NextAuth session. */
export async function authorizeRuleRead(req: Request): Promise<RuleReader> {
  const key = process.env.CONTENT_API_KEY;
  const bearer = req.headers.get("authorization") ?? "";
  if (key && bearer && secretEquals(bearer, `Bearer ${key}`)) {
    return { ok: true, by: "dgx", email: null };
  }
  const session = await auth();
  if (session?.user?.id && isVaterStudioEmail(session.user.email)) {
    return { ok: true, by: "studio", email: session.user.email ?? null };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }),
  };
}

/** Studio session only (writes). */
export async function authorizeRuleWrite(): Promise<{ ok: true; email: string } | { ok: false; response: NextResponse }> {
  const session = await auth();
  if (session?.user?.id && isVaterStudioEmail(session.user.email) && session.user.email) {
    return { ok: true, email: session.user.email };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }),
  };
}

export function sortRules<T extends { section: number; number: number; suffix: string }>(rules: T[]): T[] {
  return [...rules].sort(
    (a, b) => a.section - b.section || a.number - b.number || a.suffix.localeCompare(b.suffix),
  );
}

/** First 12 hex of sha256 over ACTIVE rules sorted by (section, number, suffix). */
export function rulesVersion(active: Pick<VaterRule, "code" | "title" | "body" | "gate" | "section" | "number" | "suffix">[]): string {
  const h = createHash("sha256");
  for (const r of sortRules(active)) {
    h.update(`${r.code}|${r.title}|${r.body}|${r.gate}|${r.section}\n`);
  }
  return h.digest("hex").slice(0, 12);
}

export function serializeRule(r: VaterRule) {
  return {
    code: r.code,
    number: r.number,
    suffix: r.suffix,
    section: r.section,
    sectionTitle: r.sectionTitle,
    title: r.title,
    body: r.body,
    source: r.source,
    gate: r.gate,
    retiredAt: r.retiredAt ? r.retiredAt.toISOString() : null,
    retiredNote: r.retiredNote,
    updatedAt: r.updatedAt.toISOString(),
    updatedBy: r.updatedBy,
  };
}

export type SerializedRule = ReturnType<typeof serializeRule>;

export function isGate(x: unknown): x is RuleGate {
  return typeof x === "string" && (RULE_GATES as readonly string[]).includes(x);
}

export function clip(x: unknown, max: number): string | undefined {
  return typeof x === "string" ? x.slice(0, max) : undefined;
}
