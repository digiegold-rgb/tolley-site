import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { publicFetch } from "./network";
import { overview } from "./control";
import { writeFile, rename } from "node:fs/promises";

export async function queueDigest() {
  const s = await overview();
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < 19) return;
  const message = `Tolley company — ${day}\n${s.capabilities.filter(c => c.status === "published").length} verified guides available.\nResearch: $${(s.budget.spentCents / 100).toFixed(2)} spent; $${(s.budget.reservedCents / 100).toFixed(2)} reserved / $500.\n${s.tasks.filter(t => !["completed", "failed", "cancelled"].includes(t.state)).length} active recent tasks. ${s.decisions.length} decisions pending.\n${s.decisions.slice(0, 3).map(d => `${d.kind}: ${d.id} — COMPANY APPROVE ${d.id} / COMPANY REJECT ${d.id}`).join("\n")}\nCommands: COMPANY STATUS, COMPANY PAUSE, COMPANY RESUME, COMPANY STOP <task-id>.`;
  if (process.env.COMPANY_SHARED_DIGEST_FILE) {
    const file = process.env.COMPANY_SHARED_DIGEST_FILE;
    await writeFile(`${file}.tmp`, JSON.stringify({ day, updatedAt: new Date().toISOString(), message }), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
    return;
  }
  await prisma.companyOutbox.upsert({ where: { id: `digest:${day}` }, create: { id: `digest:${day}`, channel: "telegram", payload: { text: message } }, update: {} });
}
export async function deliverOutbox() {
  const token = randomUUID();
  const rows = await prisma.$queryRaw<{ id: string; channel: string; keyId: string | null; userId: string | null; payload: unknown; attempts: number }[]>`UPDATE "CompanyOutbox" SET "state"='sending', "leaseToken"=${token}, "leaseUntil"=NOW()+INTERVAL '60 seconds', "attempts"="attempts"+1
    WHERE "id"=(SELECT "id" FROM "CompanyOutbox" WHERE ("state"='pending' OR ("state"='sending' AND "leaseUntil"<NOW())) AND "attempts"<5 AND "availableAt"<=NOW() ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`;
  for (const row of rows) {
    try {
      if (row.channel === "webhook") {
        const key = row.keyId ? await prisma.vaterApiKey.findFirst({ where: { id: row.keyId, userId: row.userId!, revokedAt: null } }) : null;
        if (key?.webhookUrl) {
          const text = JSON.stringify(row.payload); const timestamp = String(Math.floor(Date.now() / 1000));
          const signature = createHmac("sha256", key.keyHash).update(`${timestamp}.${text}`).digest("hex");
          const response = await publicFetch(key.webhookUrl, { method: "POST", body: text, headers: { "Content-Type": "application/json", "X-Tolley-Event-Id": row.id, "X-Tolley-Timestamp": timestamp, "X-Tolley-Signature": `sha256=${signature}` } });
          if (response.status < 200 || response.status >= 300) throw new Error("webhook_delivery_failed");
        }
      } else if (row.channel === "telegram") {
        const token = process.env.COMPANY_TELEGRAM_TOKEN; const chat = process.env.COMPANY_TELEGRAM_CHAT_ID;
        if (!token || !chat) throw new Error("telegram_not_configured");
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: (row.payload as { text: string }).text.slice(0, 4000), disable_web_page_preview: true }), signal: AbortSignal.timeout(15000) });
        if (!response.ok || !(await response.json()).ok) throw new Error("telegram_delivery_failed");
      } else throw new Error("unknown_channel");
      await prisma.companyOutbox.updateMany({ where: { id: row.id, leaseToken: token }, data: { state: "sent", leaseToken: null, leaseUntil: null, lastError: null } });
    } catch {
      await prisma.companyOutbox.updateMany({ where: { id: row.id, leaseToken: token }, data: { state: row.attempts >= 5 ? "failed" : "pending", leaseToken: null, leaseUntil: null, lastError: "Delivery failed; payload and credentials redacted.", availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** row.attempts)) } });
    }
  }
  await prisma.companyOutbox.updateMany({ where: { state: "sending", attempts: { gte: 5 }, leaseUntil: { lt: new Date() } }, data: { state: "failed", leaseUntil: null, leaseToken: null } });
}
