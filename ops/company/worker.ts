import { readFile } from "node:fs/promises";
import { prisma } from "../../lib/prisma";
import { tick } from "../../lib/company/worker";
import { learn, develop } from "../../lib/company/growth";
import { controlCommand } from "../../lib/company/control";
import { deliverOutbox, queueDigest } from "../../lib/company/outbox";
import { checkDiscoveryHealth } from "../../lib/discovery-health";

async function commands() {
  const file = process.env.COMPANY_TELEGRAM_INBOX; if (!file) return;
  const lines = (await readFile(file, "utf8").catch(() => "")).trim().split("\n").filter(Boolean);
  for (const line of lines.slice(-1000)) {
    let v: { updateId: string; chatId: string; senderId: string; command: string; argument: string };
    try { v = JSON.parse(line); } catch { continue; }
    if (String(v.chatId) !== process.env.COMPANY_TELEGRAM_CHAT_ID || String(v.senderId) !== process.env.COMPANY_TELEGRAM_OWNER_ID) continue;
    const key = `telegram:${v.updateId}`;
    if (await prisma.companyEvent.findUnique({ where: { key } })) continue;
    let message: string;
    try { const result = await controlCommand(v.command, v.argument, key); message = (result as { message?: string }).message || "Command recorded."; }
    catch { message = "Command could not be applied. Check its task/decision ID; expired approvals cannot be reused."; }
    await prisma.companyEvent.upsert({ where: { key }, create: { key, kind: "telegram.command", data: { command: v.command } }, update: {} });
    await prisma.companyOutbox.upsert({ where: { id: `reply:${v.updateId}` }, create: { id: `reply:${v.updateId}`, channel: "telegram", payload: { text: message } }, update: {} });
  }
}
async function health() {
  const last = await prisma.companyEvent.findFirst({ where: { kind: "health" }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - +last.createdAt < 86400000) return;
  const results = await checkDiscoveryHealth(process.env.COMPANY_SITE_URL || "https://www.tolley.io");
  await prisma.companyEvent.create({ data: { key: `health:${Date.now()}`, kind: "health", data: { passed: results.filter(r => r.ok).length, total: results.length, failures: results.filter(r => !r.ok) } } });
}
async function availability() {
  const base = process.env.COMPANY_SITE_URL || "https://www.tolley.io";
  const checks = await Promise.all(["/services/agent", "/api/v1/capabilities"].map(async path => {
    try { const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "TolleyCompanyHealth/1.0" } }); return { path, status: response.status, ok: response.ok }; }
    catch { return { path, status: 0, ok: false }; }
  }));
  await prisma.companyEvent.create({ data: { key: `availability:${Date.now()}`, kind: "health.availability", data: { checks, ok: checks.every(c => c.ok) } } });
}
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
async function repeat(label: string, interval: number, work: () => Promise<unknown>) {
  do {
    const started = Date.now();
    try { await work(); }
    catch (error) {
      console.error(`[company-worker] ${label} failed`, error instanceof Error ? error.name : "unknown");
      await prisma.companyEvent.upsert({ where: { key: `worker.error:${label}:${Math.floor(Date.now()/60000)}` }, create: { key: `worker.error:${label}:${Math.floor(Date.now()/60000)}`, kind: "worker.error", data: { loop: label, error: "operation_failed" } }, update: {} }).catch(() => undefined);
    }
    if (process.argv.includes("--once")) break;
    const remaining = Math.max(1000, interval - (Date.now() - started));
    for (let elapsed = 0; !stopping && elapsed < remaining; elapsed += 1000) await new Promise(resolve => setTimeout(resolve, 1000));
  } while (!stopping);
}
async function main() {
  // Slow research and daily crawling must not block commands, delivery, or task progress.
  await Promise.all([
    repeat("tasks", 5000, tick),
    repeat("commands", 5000, commands),
    repeat("learning", 60000, learn),
    repeat("development", 10000, develop),
    repeat("delivery", 5000, deliverOutbox),
    repeat("digest", 60000, queueDigest),
    repeat("health", 300000, health),
    repeat("availability", 300000, availability),
  ]);
}
main().finally(() => prisma.$disconnect());
