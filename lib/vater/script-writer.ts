/**
 * lib/vater/script-writer.ts — on-site Claude script generation.
 *
 * Rule load lives here (prisma). The Claude call, effort, max_tokens, empty
 * retry, and refusal handling live in script-writer-run.ts so they can be
 * unit-tested without the server graph.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { SCRIPT_WRITER_FALLBACK_RULES } from "./script-writer-run";

export * from "./script-writer-run";

const MAX_RULES_CHARS = 24_000;

export async function loadScriptRulesForUser(
  userId: string,
  email: string | null | undefined,
): Promise<string> {
  try {
    const studio = isVaterStudioEmail(email);
    const rules = await prisma.vaterRule.findMany({
      where: {
        kind: "script",
        retiredAt: null,
        OR: studio
          ? [{ scope: { in: ["global", "house"] } }, { scope: "owner", ownerId: userId }]
          : [{ scope: "global" }, { scope: "owner", ownerId: userId }],
      },
      orderBy: [{ section: "asc" }, { number: "asc" }],
      select: { code: true, title: true, body: true },
      take: 80,
    });
    if (rules.length === 0) return SCRIPT_WRITER_FALLBACK_RULES;
    const text = rules
      .map((r) => {
        const body = (r.body || "").trim();
        return body ? `${r.code} — ${r.title}\n${body}` : `${r.code} — ${r.title}`;
      })
      .join("\n\n");
    return text.slice(0, MAX_RULES_CHARS);
  } catch (err) {
    console.error("[script-writer] rule load failed; using fallback pack", err);
    return SCRIPT_WRITER_FALLBACK_RULES;
  }
}
