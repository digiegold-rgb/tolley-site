import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBalance } from "@/lib/vater/billing/ledger";
import { localEstimate, quoteMinutes } from "@/lib/vater/billing/estimate";
import { getOpsRate } from "@/lib/vater/billing/ops-fee";
import { resolveStyleForUser } from "@/lib/vater/public-api";
import { getSubsite } from "@/lib/subsites";
import { validateActionFields } from "@/lib/agent-manifest";
import { capability, type Capability } from "./catalog";
import { COMPANY_POLICY, CompanyError, fingerprint, monthKey, terminal } from "./policy";
import { walletLock, holdCredit } from "./credits";
import type { Principal } from "./auth";

export const jsonValue = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function controls() { return prisma.companyControl.upsert({ where: { id: "company" }, create: { id: "company" }, update: {} }); }
export async function allCapabilities() {
  const { capabilities } = await import("./catalog");
  const dynamic = await prisma.companyCapability.findMany({ where: { status: "published" }, orderBy: { id: "asc" }, take: 500 });
  return [...capabilities(), ...dynamic.map(r => ({ ...(r.manifest as unknown as Capability), version: String(r.version) }))];
}
export async function findCapability(id: string, db: Prisma.TransactionClient = prisma) {
  const builtIn = capability(id); if (builtIn) return builtIn;
  const row = await db.companyCapability.findFirst({ where: { id, status: "published" } });
  return row ? { ...(row.manifest as unknown as Capability), version: String(row.version) } : undefined;
}
function validatedInput(c: Capability, input: unknown) {
  if (c.adapter === "video") return z.object({ script: z.string().trim().min(40).max(200000).refine(s => s.split(/\s+/).length >= 20), title: z.string().max(200).optional(), styleId: z.string().max(200).optional(), features: z.object({ motionMode: z.enum(["draft", "full"]).default("draft"), aspect: z.enum(["16:9", "9:16"]).default("16:9") }).strict().default({ motionMode: "draft", aspect: "16:9" }) }).strict().parse(input);
  if (c.adapter === "inquiry") {
    const v = z.object({ contact: z.object({ name: z.string().max(120).optional(), email: z.email().max(254).optional(), phone: z.string().min(7).max(40).optional() }).strict().refine(v => !!v.email || !!v.phone), fields: z.record(z.string(), z.union([z.string().max(4000), z.number().finite(), z.boolean()])) }).strict().parse(input);
    const a = getSubsite(c.subsite!)?.actions.find(a => a.verb === c.action);
    if (!a || Object.keys(v.fields).some(k => !a.fields[k])) throw new CompanyError("invalid_fields");
    const error = validateActionFields(a, v.fields); if (error) throw new CompanyError("invalid_fields", 400, error);
    return v;
  }
  return z.object({ question: z.string().trim().max(4000).default(""), sources: z.array(z.url().max(2000)).max(5).optional() }).strict().parse(input);
}
export async function makeQuote(p: Principal, raw: unknown) {
  const { capabilityId, input } = z.object({ capabilityId: z.string().max(150), input: z.unknown() }).strict().parse(raw);
  const c = await findCapability(capabilityId); if (!c) throw new CompanyError("unknown_capability", 404);
  const normalized = validatedInput(c, input);
  let providerCents = 0, serviceCents = 0;
  if (c.adapter === "video") {
    const v = normalized as { script: string; styleId?: string; features: { motionMode: string } };
    const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { email: true } });
    const style = await resolveStyleForUser(p.userId, user?.email || null, v.styleId);
    if (!style.ok) throw new CompanyError(style.error, style.status, style.message);
    v.styleId = style.styleId;
    const e = localEstimate({ minutes: quoteMinutes(v.script.split(/\s+/).length), opsRatePerMinute: getOpsRate() });
    const max = Math.round((v.features.motionMode === "full" ? e.fullUsd : e.draftUsd) * 100);
    serviceCents = Math.round(e.breakdown.ops * 100); providerCents = max - serviceCents;
  } else if (c.adapter === "research") {
    if (!(normalized as { question: string }).question) throw new CompanyError("question_required");
    // Local-only research: a flat, disclosed fulfillment fee; no hidden cloud calls.
    serviceCents = 100;
  }
  const quote = await prisma.companyQuote.create({ data: { userId: p.userId, keyId: p.keyId, capabilityId: c.id, capabilityVersion: c.version, input: jsonValue(normalized), inputHash: fingerprint(normalized), providerCents, serviceCents, maxCents: providerCents + serviceCents, expiresAt: new Date(Date.now() + COMPANY_POLICY.quoteLifetimeMs) } });
  return { id: quote.id, capabilityId: c.id, version: c.version, currency: "USD", providerCents, serviceCents, maxCents: quote.maxCents, expiresAt: quote.expiresAt, cancellation: "Queued work cancels without charge. Running provider work is reconciled before cancellation; charges never exceed this quote. Failed delivery is not charged.", input: normalized };
}
export async function createTask(p: Principal, key: string | null, raw: unknown) {
  if (!key || !/^[A-Za-z0-9:_-]{8,128}$/.test(key)) throw new CompanyError("idempotency_key_required");
  const input = z.object({ quoteId: z.string().max(100), maxCents: z.number().int().nonnegative().max(1000000) }).strict().parse(raw);
  const hash = fingerprint(input);
  return prisma.$transaction(async tx => {
    await walletLock(tx, p.userId);
    const old = await tx.companyTask.findUnique({ where: { userId_idempotencyKey: { userId: p.userId, idempotencyKey: key } } });
    if (old) { if (old.requestHash !== hash || old.keyId !== p.keyId) throw new CompanyError("idempotency_conflict", 409); return old; }
    const control = await tx.companyControl.findUnique({ where: { id: "company" } });
    if (!control?.admission) throw new CompanyError("admission_paused", 503);
    const quote = await tx.companyQuote.findUnique({ where: { id: input.quoteId } });
    if (!quote || quote.userId !== p.userId || quote.keyId !== p.keyId) throw new CompanyError("quote_not_found", 404);
    if (quote.expiresAt <= new Date()) throw new CompanyError("quote_expired", 409);
    if (input.maxCents < quote.maxCents) throw new CompanyError("quote_exceeds_authority", 402);
    if (await tx.companyTask.findUnique({ where: { quoteId: quote.id } })) throw new CompanyError("quote_already_used", 409);
    const c = await findCapability(quote.capabilityId, tx);
    if (!c || c.version !== quote.capabilityVersion) throw new CompanyError("capability_changed", 409);
    // Re-read authority inside the transaction; a client cannot retain revoked grants.
    const grant = await tx.companyKeyGrant.findUnique({ where: { keyId: p.keyId } });
    const apiKey = await tx.vaterApiKey.findUnique({ where: { id: p.keyId } });
    if (!grant?.scopes.includes("tasks:write") || grant.userId !== p.userId || !apiKey || apiKey.revokedAt) throw new CompanyError("scope_required", 403);
    const tasks = await tx.companyTask.findMany({ where: { keyId: p.keyId, createdAt: { gte: new Date(Date.now() - 32 * 86400000) } }, select: { createdAt: true, state: true, chargedCents: true, maxCents: true } });
    const spent = tasks.filter(t => monthKey(t.createdAt) === monthKey()).reduce((s, t) => s + (terminal(t.state) ? t.chargedCents : t.maxCents), 0);
    if (spent + quote.maxCents > grant.monthlyLimitCents) throw new CompanyError("key_spend_limit", 402);
    if (await tx.companyTask.count({ where: { userId: p.userId, state: { notIn: ["completed", "failed", "cancelled"] } } }) >= 50) throw new CompanyError("active_task_limit", 429);
    const task = await tx.companyTask.create({ data: { userId: p.userId, keyId: p.keyId, quoteId: quote.id, idempotencyKey: key, requestHash: hash, capabilityId: c.id, capabilityVersion: c.version, adapter: c.adapter, input: quote.input as Prisma.InputJsonValue, maxCents: quote.maxCents, providerCents: quote.providerCents, serviceCents: quote.serviceCents } });
    if (quote.maxCents) {
      if (process.env.COMPANY_CREDITS_ENABLED !== "1") throw new CompanyError("paid_execution_unavailable", 503);
      const balance = await getBalance(p.userId, tx); if (!balance.ready) throw new CompanyError("ledger_unavailable", 503);
      await holdCredit(tx, { id: `task:${task.id}`, userId: p.userId, amount: quote.maxCents, available: balance.purchasedCents, purchasedOnly: true, taskId: task.id });
    }
    await tx.companyEvent.create({ data: { key: `accepted:${task.id}`, taskId: task.id, userId: p.userId, kind: "task.accepted", data: { capabilityId: c.id, quoteId: quote.id } } });
    return task;
  }, { timeout: 20000 });
}
export async function getTask(p: Principal, id: string) {
  const row = await prisma.companyTask.findFirst({ where: { id, userId: p.userId } });
  if (!row) throw new CompanyError("not_found", 404);
  return taskView(row);
}
export function taskView(t: { id: string; capabilityId: string; state: string; result: unknown; error: string | null; maxCents: number; chargedCents: number; cancelRequested: boolean; createdAt: Date; completedAt: Date | null }) {
  return { id: t.id, capabilityId: t.capabilityId, status: t.state, result: t.result, error: t.error, cancelRequested: t.cancelRequested, receipt: { currency: "USD", maxCents: t.maxCents, chargedCents: t.chargedCents }, createdAt: t.createdAt, completedAt: t.completedAt, pollUrl: `/api/v1/tasks/${t.id}` };
}
export async function cancelTask(p: Principal, id: string) {
  await prisma.$transaction(async tx => {
    await walletLock(tx, p.userId);
    const task = await tx.companyTask.findFirst({ where: { id, userId: p.userId } });
    if (!task) throw new CompanyError("not_found", 404);
    if (terminal(task.state)) return;
    await tx.companyTask.update({ where: { id }, data: { cancelRequested: true } });
  });
  return getTask(p, id);
}
export async function knowledge(userId: string | null, q: string) {
  // Audience restrictions are part of the SQL query, never a post-retrieval filter.
  const query = q.trim().slice(0, 300);
  return prisma.$queryRaw`SELECT "id", "title", "body", "sources", "evidence", "updatedAt", "audience" FROM "CompanyKnowledge"
    WHERE "status" = 'verified' AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
    AND ("audience" = 'public' OR ("audience" = 'customer' AND "userId" = ${userId}))
    AND (${query} = '' OR to_tsvector('english', "title" || ' ' || "body") @@ websearch_to_tsquery('english', ${query}))
    ORDER BY "updatedAt" DESC LIMIT 20`;
}
