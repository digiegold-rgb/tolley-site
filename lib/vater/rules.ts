/**
 * Online rulebook — shared helpers for /api/vater/rules.
 *
 * The rulebook (VaterRule) is the source of truth for the numbered production
 * rules (2026-08-25, rule 158). Every render on the DGX (scene planner, Fable
 * runner, delivery audit) fetches it and records `version`.
 *
 * SCOPES (2026-08-25 PM — Jared: "extract the principles… allow everyone to
 * have the rules, but not copy Jeff Whitfield… when they build a character
 * that character gets its own subset of rules"):
 *   global — de-branded principles every render reads. Codes "G<n>".
 *            Everyone can read; only studio/admin sessions edit.
 *   house  — Trey's studio rulebook (the original 159 rows). Codes
 *            "1".."158"/"78a". Studio-only, read and write.
 *   owner  — a signed-in user's own rules, optionally pinned to one of their
 *            characters. Codes "<ownerId>:<n>" (displayed "#<n>", numbering
 *            is per owner and permanent). Only the owner reads/writes them;
 *            the DGX (API key) reads them for that owner's renders.
 *
 * `version` is a content hash over the ACTIVE rules RETURNED by a request
 * (scope-aware): a planner that fetched `scope=global&owner=X` and an audit
 * that fetched the same get the same id; a different owner gets a different
 * one — which is the point, it identifies the rule set that render obeyed.
 */
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";
import type { VaterRule } from "@prisma/client";

export const RULE_GATES = ["hard", "advisory", "planner", "info"] as const;
export type RuleGate = (typeof RULE_GATES)[number];

export const RULE_SCOPES = ["global", "house", "owner"] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export type RuleReader =
  | { ok: true; by: "dgx"; email: null; userId: null; studio: true }
  | { ok: true; by: "studio" | "user"; email: string | null; userId: string; studio: boolean }
  | { ok: false; response: NextResponse };

/**
 * Bearer CONTENT_API_KEY (constant-time, the DGX) OR any signed-in session.
 * `studio` says whether the caller may see house rules / edit global ones.
 */
export async function authorizeRuleRead(req: Request): Promise<RuleReader> {
  const key = process.env.CONTENT_API_KEY;
  const bearer = req.headers.get("authorization") ?? "";
  if (key && bearer && secretEquals(bearer, `Bearer ${key}`)) {
    return { ok: true, by: "dgx", email: null, userId: null, studio: true };
  }
  const session = await auth();
  if (session?.user?.id) {
    const studio = isVaterStudioEmail(session.user.email);
    return { ok: true, by: studio ? "studio" : "user", email: session.user.email ?? null, userId: session.user.id, studio };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }),
  };
}

export type RuleWriter =
  | { ok: true; email: string; userId: string; studio: boolean }
  | { ok: false; response: NextResponse };

/** Any signed-in session may write OWNER rules; global/house need `studio`. */
export async function authorizeRuleWrite(): Promise<RuleWriter> {
  const session = await auth();
  if (session?.user?.id) {
    return {
      ok: true,
      email: session.user.email ?? session.user.id,
      userId: session.user.id,
      studio: isVaterStudioEmail(session.user.email),
    };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }),
  };
}

/** Can this writer edit/create a rule in `scope` (owned by `ownerId`)? */
export function canWriteScope(w: { userId: string; studio: boolean }, scope: string, ownerId: string | null): boolean {
  if (scope === "owner") return !!ownerId && ownerId === w.userId;
  return w.studio; // global + house
}

/** Which scopes may this reader see? (owner rules are further filtered by ownerId) */
export function readableScopes(r: Extract<RuleReader, { ok: true }>): RuleScope[] {
  if (r.by === "dgx") return ["global", "house", "owner"];
  return r.studio ? ["global", "house", "owner"] : ["global", "owner"];
}

export function isScope(x: unknown): x is RuleScope {
  return typeof x === "string" && (RULE_SCOPES as readonly string[]).includes(x);
}

export function sortRules<T extends { scope?: string; section: number; number: number; suffix: string }>(rules: T[]): T[] {
  const rank = (s?: string) => (s === "global" ? 0 : s === "house" ? 1 : 2);
  return [...rules].sort(
    (a, b) => rank(a.scope) - rank(b.scope) || a.section - b.section || a.number - b.number || a.suffix.localeCompare(b.suffix),
  );
}

/** First 12 hex of sha256 over the given ACTIVE rules sorted (scope, section, number, suffix). */
export function rulesVersion(active: Pick<VaterRule, "code" | "title" | "body" | "gate" | "section" | "number" | "suffix" | "scope">[]): string {
  const h = createHash("sha256");
  for (const r of sortRules(active)) {
    h.update(`${r.code}|${r.title}|${r.body}|${r.gate}|${r.section}\n`);
  }
  return h.digest("hex").slice(0, 12);
}

/** "G7" / "42" / "#12" — what humans see for a code. */
export function displayCode(r: Pick<VaterRule, "code" | "scope" | "number" | "suffix">): string {
  if (r.scope === "owner") return `#${r.number}${r.suffix}`;
  return r.code;
}

export function serializeRule(r: VaterRule) {
  return {
    code: r.code,
    display: displayCode(r),
    scope: r.scope,
    ownerId: r.ownerId,
    characterId: r.characterId,
    templateKey: r.templateKey,
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

/** house "79"/"78a", global "G12", owner "<cuid>:7" */
export const CODE_RE = /^(\d{1,4}[a-z]?|G\d{1,4}|[A-Za-z0-9_-]{6,40}:\d{1,5})$/;

/** Default section for a new owner rule: 1 = "My rules", 2 = character rules. */
export const OWNER_SECTIONS: Record<number, string> = {
  1: "My rules",
  2: "Character rules",
};
