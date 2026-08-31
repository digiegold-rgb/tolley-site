/**
 * Character-rule seed core. Extracted from the session-authed
 * /api/vater/rules/character-seed route so DGX scripts can seed hidden
 * tab users (email NULL) without POSTing that route.
 */
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { OWNER_SECTIONS, serializeRule } from "@/lib/vater/rules";

type TemplateRule = {
  key: string;
  title: string;
  body: string;
  gate?: string;
  placeholders?: string[];
  section?: number;
};

function loadTemplate(): TemplateRule[] {
  for (const p of [
    path.join(process.cwd(), "data", "CHARACTER-RULE-TEMPLATE.json"),
    "/home/jelly/vater-studio/CHARACTER-RULE-TEMPLATE.json",
  ]) {
    try {
      const j = JSON.parse(readFileSync(p, "utf8")) as { rules?: TemplateRule[] };
      if (Array.isArray(j.rules) && j.rules.length) return j.rules;
    } catch {
      /* try next */
    }
  }
  return FALLBACK_TEMPLATE;
}

const FALLBACK_TEMPLATE: TemplateRule[] = [
  { key: "host-every-video", title: "{name} is the host of every video.", body: "{name} appears in about half of all scenes, talking to camera, and is index 0 in any roster. Vary pose and framing scene to scene; never the same shot twice in a row.", gate: "planner" },
  { key: "identity-lock", title: "{name}'s identity never changes.", body: "Face, hair, skin, build and age are locked across every scene and every video: {invariants}. Descriptors state these as positive, concrete description — never as negations.", gate: "hard" },
  { key: "attire", title: "{name} always wears {attire}.", body: "One outfit per act; the outfit never drifts mid-act. Never describe clothing in scene prompts — the locked wardrobe is injected by the renderer.", gate: "hard" },
  { key: "never-cloned", title: "Never two {name}s in one frame.", body: "{name} appears at most once per scene; crowds are staged as distinct extras or people-free.", gate: "hard" },
  { key: "name-never-printed", title: "The name \"{name}\" is never printed on a prop, chart, document or sign.", body: "If a beat would put the host's name on a prop, make the scene people-free or use unlabeled props.", gate: "hard" },
  { key: "role", title: "{name} is a {role} — props and settings match that role.", body: "Key props are the tools of the role, large enough to read, facing the audience.", gate: "planner" },
  { key: "expressions", title: "{name}'s expression matches the narration's tone in every scene.", body: "Explaining, not selling: calm, warm, confident; concern only when the script is concerned.", gate: "advisory" },
  { key: "voice", title: "{name} has ONE voice.", body: "The same voice id narrates every video; never clone a real person's voice.", gate: "info" },
];

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? GENERIC[k] ?? `{${k}}`);
}
const GENERIC: Record<string, string> = {
  name: "the host",
  attire: "their locked outfit",
  role: "presenter",
  invariants: "the locked face, hair, skin tone and build from the character descriptor",
};

function invariantsFrom(descriptor: string): string {
  const s = descriptor.replace(/\s+/g, " ").trim();
  if (!s) return GENERIC.invariants;
  const parts = s.split(/(?<=[.!])\s+/).slice(0, 2).join(" ");
  return parts.length > 260 ? parts.slice(0, 260).replace(/\s\S*$/, "") + "…" : parts;
}

export interface SeedCharacterInput {
  ownerId: string;
  email: string | null;
  characterId: string;
  name: string;
  descriptor?: string;
  attire?: string;
  role?: string;
}

export interface SeedCharacterResult {
  characterId: string;
  name: string;
  created: number;
  skipped: number;
  rules: ReturnType<typeof serializeRule>[];
}

export async function seedCharacterRules(
  input: SeedCharacterInput,
): Promise<SeedCharacterResult> {
  const name = input.name.trim().slice(0, 80);
  const descriptor = (input.descriptor ?? "").trim().slice(0, 4000);
  const vars: Record<string, string> = {
    name,
    attire: input.attire?.trim() ? input.attire.trim().slice(0, 120) : GENERIC.attire,
    role: input.role?.trim() ? input.role.trim().slice(0, 80) : GENERIC.role,
    invariants: invariantsFrom(descriptor),
  };
  const template = loadTemplate();
  const existing = await prisma.vaterRule.findMany({
    where: { scope: "owner", ownerId: input.ownerId, characterId: input.characterId },
    select: { templateKey: true },
  });
  const have = new Set(existing.map((r) => r.templateKey).filter(Boolean));
  const max = await prisma.vaterRule.aggregate({
    where: { scope: "owner", ownerId: input.ownerId },
    _max: { number: true },
  });
  let number = max._max.number ?? 0;
  const created = [];
  const by = input.email ?? input.ownerId;
  for (const tr of template) {
    if (!tr.key || have.has(tr.key)) continue;
    number += 1;
    const code = `${input.ownerId}:${number}`;
    const gate = ["hard", "advisory", "planner", "info"].includes(String(tr.gate))
      ? String(tr.gate)
      : "planner";
    const row = await prisma.vaterRule.create({
      data: {
        code,
        number,
        suffix: "",
        scope: "owner",
        ownerId: input.ownerId,
        characterId: input.characterId,
        templateKey: tr.key,
        section: 2,
        sectionTitle: OWNER_SECTIONS[2],
        title: fill(tr.title, vars).slice(0, 400),
        body: fill(tr.body, vars).slice(0, 8000),
        source: `character template · ${name}`,
        gate,
        updatedBy: by,
      },
    });
    await prisma.vaterRuleRevision.create({
      data: {
        code,
        before: undefined,
        after: serializeRule(row),
        by,
        note: `seeded from template ${tr.key} for ${name}`,
      },
    });
    created.push(row);
  }
  return {
    characterId: input.characterId,
    name,
    created: created.length,
    skipped: template.length - created.length,
    rules: created.map(serializeRule),
  };
}
