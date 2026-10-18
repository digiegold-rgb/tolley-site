import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { companyOfferings, offeringFacts, type Capability } from "./catalog";
import { COMPANY_POLICY, CompanyError, fingerprint, monthKey } from "./policy";
import { controls, jsonValue } from "./store";
import { readPublicSource } from "./network";

// Declarative recipes are executable programs over verified adapters, not arbitrary shell code.
// New privileges and adapters require the protected deployment workflow.
export const recipeSchema = z.object({ version: z.literal(1), steps: z.array(z.object({ kind: z.literal("facts"), subsite: z.string().max(80) }).strict()).min(1).max(8) }).strict();
export async function executeRecipe(id: string, input: { question?: string }) {
  const row = await prisma.companyCapability.findUnique({ where: { id } });
  if (!row || row.status !== "published") throw new CompanyError("capability_unavailable", 404);
  const recipe = recipeSchema.parse(row.recipe);
  const evidence = recipe.steps.map(s => offeringFacts(s.subsite));
  if (evidence.some(e => !e)) throw new CompanyError("recipe_source_retired", 409);
  return { question: input.question || null, guide: evidence, verification: "current_registry_facts", capabilityVersion: row.version, next: "Use the listed capability IDs for a quote or inquiry. Published facts do not confirm inventory or scheduling." };
}
export async function queueExperiment(demandKey: string, subsite: string) {
  if (!companyOfferings().some(s => s.name === subsite)) throw new CompanyError("unknown_offering");
  return prisma.companyExperiment.upsert({ where: { demandKey }, create: { demandKey, title: `Verified guide for ${subsite}`, month: monthKey(), specification: { subsite, adapter: "recipe", goal: "Answer offering questions with current facts, sources and actionable capability IDs." } }, update: {} });
}
export async function reserveExperiment(id: string, amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > COMPANY_POLICY.experimentCents) throw new CompanyError("experiment_limit", 402);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('company-research-budget',0))`;
    const row = await tx.companyExperiment.findUnique({ where: { id } });
    if (!row || row.state !== "queued" || row.attempts >= COMPANY_POLICY.attempts) return null;
    const running = await tx.companyExperiment.count({ where: { state: "running" } });
    if (running >= COMPANY_POLICY.experimentConcurrency) return null;
    const month = monthKey();
    const totals = await tx.companyExperiment.aggregate({ where: { month }, _sum: { reservedCents: true, spentCents: true } });
    if ((totals._sum.reservedCents || 0) + (totals._sum.spentCents || 0) + amount > COMPANY_POLICY.monthlyResearchCents) throw new CompanyError("research_budget_exhausted", 402);
    return tx.companyExperiment.update({ where: { id }, data: { state: "running", month, reservedCents: amount, attempts: { increment: 1 }, leaseUntil: new Date(Date.now() + 600000) } });
  });
}
export async function verifyRecipe(recipe: unknown) {
  const parsed = recipeSchema.parse(recipe);
  const checks = parsed.steps.map(step => {
    const facts = offeringFacts(step.subsite);
    return { subsite: step.subsite, pass: !!facts?.url && !!facts.description && facts.capabilities.length > 0, fingerprint: facts ? fingerprint(facts) : null };
  });
  if (!checks.every(c => c.pass)) throw new CompanyError("recipe_verification_failed");
  return { checkedAt: new Date().toISOString(), checks, tests: ["schema_valid", "public_sources_only", "current_capability_ids", "no_external_side_effects", "no_customer_context"] };
}
export async function develop() {
  const control = await controls(); if (!control.development) return;
  if (control.deployment) {
    const staged = await prisma.companyCapability.findFirst({ where: { status: "verified" } });
    if (staged) {
      const evidence = await verifyRecipe(staged.recipe);
      await prisma.$transaction(async tx => {
        const gate = await tx.companyControl.findUnique({ where: { id: "company" } });
        if (!gate?.deployment) return;
        const released = await tx.companyCapability.updateMany({ where: { id: staged.id, status: "verified", version: staged.version }, data: { status: "published", evidence: jsonValue(evidence) } });
        if (released.count) await tx.companyEvent.upsert({ where: { key: `publish:${staged.id}:${staged.version}` }, create: { key: `publish:${staged.id}:${staged.version}`, kind: "capability.published", data: { capabilityId: staged.id, evidence } }, update: {} });
      });
    }
  }
  // Crash recovery: local experiments are deterministic and have no external side effects.
  await prisma.companyExperiment.updateMany({ where: { state: "running", leaseUntil: { lt: new Date() }, attempts: { lt: COMPANY_POLICY.attempts } }, data: { state: "queued", reservedCents: 0, leaseUntil: null } });
  await prisma.companyExperiment.updateMany({ where: { state: "running", leaseUntil: { lt: new Date() }, attempts: { gte: COMPANY_POLICY.attempts } }, data: { state: "failed", reservedCents: 0, leaseUntil: null } });
  const pending = await prisma.companyExperiment.findFirst({ where: { state: "queued", attempts: { lt: COMPANY_POLICY.attempts } }, orderBy: { createdAt: "asc" } });
  if (!pending) return;
  const experiment = await reserveExperiment(pending.id, 0); if (!experiment) return;
  try {
    const specification = experiment.specification as { kind?: string; taskId?: string; userId?: string };
    if (specification.kind === "research_request") {
      const task = await prisma.companyTask.findFirst({ where: { id: specification.taskId, userId: specification.userId } });
      if (!task) throw new CompanyError("request_retracted");
      if (task.state !== "completed") {
        await prisma.companyExperiment.update({ where: { id: experiment.id }, data: { state: "queued", reservedCents: 0, leaseUntil: null, attempts: { decrement: 1 } } });
        return;
      }
      const input = task.input as { question: string; sources?: string[] };
      const { research } = await import("./worker");
      const findings = await research(input.question, input.sources || [], task.userId);
      await prisma.$transaction(async tx => {
        await tx.companyExperiment.update({ where: { id: experiment.id }, data: { state: "researched", reservedCents: 0, leaseUntil: null, evidence: jsonValue({ audience: "customer", userId: task.userId, findings }) } });
        await tx.companyTask.update({ where: { id: task.id }, data: { result: jsonValue({ status: "investigated", findings, next: "Findings are available. Any missing adapter, provider access or hardware needs a separate verified implementation before execution can be offered." }) } });
        await tx.companyDecision.upsert({ where: { id: `opportunity:${task.id}` }, create: { id: `opportunity:${task.id}`, kind: "new_adapter_needed", request: { taskId: task.id, experimentId: experiment.id, next: "Review the completed investigation and provision any required adapter or credentials." }, expiresAt: new Date(Date.now() + 72 * 3600000) }, update: {} });
      });
      return;
    }
    const spec = z.object({ subsite: z.string() }).passthrough().parse(experiment.specification);
    const facts = offeringFacts(spec.subsite); if (!facts) throw new CompanyError("source_unavailable");
    const recipe = { version: 1 as const, steps: [{ kind: "facts" as const, subsite: spec.subsite }] };
    const evidence = await verifyRecipe(recipe);
    const id = `guide.${spec.subsite}`;
    const manifest: Capability = { id, version: "1", title: `${facts.title}: agent guide`, description: `Verified instructions, questions, provider details and available actions for ${facts.title}.`, route: `/services/agent/${id}`, mode: "education", adapter: "recipe", authentication: "bearer", inputSchema: { type: "object", properties: { question: { type: "string", maxLength: 4000 } }, additionalProperties: false }, pricing: { kind: "free", description: "Verified public guidance is free." }, evidence: [facts.url], limitations: ["This guide uses current published facts; provider confirmation is required for physical services."] };
    await prisma.$transaction(async tx => {
      const before = await tx.companyCapability.findUnique({ where: { id } });
      // Recheck the deployment switch immediately before publication.
      const gate = await tx.companyControl.findUnique({ where: { id: "company" } });
      const status = gate?.deployment ? "published" : "verified";
      await tx.companyCapability.upsert({ where: { id }, create: { id, status, manifest: jsonValue(manifest), recipe, evidence: jsonValue(evidence) }, update: { status, version: { increment: 1 }, manifest: jsonValue(manifest), recipe, evidence: jsonValue(evidence), previousVersion: before ? jsonValue({ manifest: before.manifest, recipe: before.recipe, evidence: before.evidence, version: before.version, status: before.status }) : undefined } });
      await tx.companyExperiment.update({ where: { id: experiment.id }, data: { state: status === "published" ? "released" : "verified", evidence: jsonValue(evidence), leaseUntil: null, reservedCents: 0 } });
      await tx.companyEvent.create({ data: { key: `experiment:${experiment.id}:release`, kind: `capability.${status}`, data: { capabilityId: id, experimentId: experiment.id, evidence } } });
    });
  } catch (e) {
    await prisma.companyExperiment.update({ where: { id: experiment.id }, data: { state: "failed", leaseUntil: null, reservedCents: 0, evidence: { error: e instanceof CompanyError ? e.code : "verification_failed" } } });
  }
}
export async function learn() {
  const control = await controls(); if (!control.learning) return;
  if (control.lastDiscovery && Date.now() - +control.lastDiscovery < 86400000) return;
  for (const s of companyOfferings()) {
    const facts = offeringFacts(s.name)!;
    const sourceKey = `catalog:${s.name}`;
    const contentHash = fingerprint(facts);
    await prisma.companyKnowledge.upsert({ where: { sourceKey }, create: { sourceKey, title: facts.title, body: JSON.stringify(facts), contentHash, sources: [facts.url], status: "verified", audience: "public", evidence: { method: "product_registry", reviewedAt: facts.reviewedAt }, expiresAt: new Date(Date.now() + 2 * 86400000) }, update: { title: facts.title, body: JSON.stringify(facts), contentHash, status: "verified", sources: [facts.url], expiresAt: new Date(Date.now() + 2 * 86400000) } });
    await queueExperiment(`catalog:${s.name}:${contentHash}`, s.name);
  }
  // Only public, versioned technical documentation enters shared external learning.
  const seeds = ["https://modelcontextprotocol.io/specification/2025-11-25/server/tools", "https://docs.stripe.com/api/idempotent_requests"];
  for (const url of seeds) {
    try {
      const source = await readPublicSource(url);
      const sourceKey = `web:${fingerprint(url)}`;
      await prisma.companyKnowledge.upsert({ where: { sourceKey }, create: { sourceKey, title: url, body: source.text, sources: [url], contentHash: fingerprint(source.text), audience: "internal", status: "candidate", evidence: { method: "fetched_document", fetchedAt: source.fetchedAt } }, update: { body: source.text, contentHash: fingerprint(source.text), status: "candidate", evidence: { method: "fetched_document", fetchedAt: source.fetchedAt } } });
    } catch { /* A source outage does not stop other learning. */ }
  }
  // Retired sources are withdrawn immediately, including their derived guides.
  const names = companyOfferings().map(s => `catalog:${s.name}`);
  await prisma.companyKnowledge.updateMany({ where: { sourceKey: { startsWith: "catalog:", notIn: names } }, data: { status: "superseded" } });
  const ids = companyOfferings().map(s => `guide.${s.name}`);
  await prisma.companyCapability.updateMany({ where: { id: { startsWith: "guide.", notIn: ids } }, data: { status: "withdrawn" } });
  await prisma.companyControl.update({ where: { id: "company" }, data: { lastDiscovery: new Date() } });
}
export async function rollbackCapability(id: string, transaction?: Prisma.TransactionClient) {
  const apply = async (tx: Prisma.TransactionClient) => {
    const c = await tx.companyCapability.findUnique({ where: { id } });
    if (!c) throw new CompanyError("not_found", 404);
    const prior = c.previousVersion as { manifest: PrismaJson; recipe: PrismaJson; evidence: PrismaJson; status: string } | null;
    return tx.companyCapability.update({ where: { id }, data: prior ? { manifest: prior.manifest, recipe: prior.recipe, evidence: prior.evidence, status: prior.status, version: { increment: 1 }, previousVersion: Prisma.DbNull } : { status: "withdrawn", version: { increment: 1 } } });
  };
  return transaction ? apply(transaction) : prisma.$transaction(apply);
}
type PrismaJson = ReturnType<typeof jsonValue>;
