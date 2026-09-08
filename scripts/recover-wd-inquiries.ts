/** Review by default. --apply creates historical HQ records, never notifications. */
import { PrismaClient, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
const p = new PrismaClient();
const apply = process.argv.includes("--apply");
async function main() {
  const events = await p.siteEvent.findMany({ where: { site: "wd", event: { in: ["lead_submit", "email_capture"] } }, orderBy: { createdAt: "asc" }, select: { id: true, event: true, meta: true, createdAt: true } });
  const [knownLeads, customers, emailLeads] = await Promise.all([
    p.leadAction.findMany({ where: { subsite: "wd" }, select: { email: true, phone: true } }),
    p.wdClient.findMany({ select: { email: true, phone: true } }),
    p.emailLead.findMany({ select: { email: true } }),
  ]);
  const known = new Set<string>();
  for (const contact of [...knownLeads, ...customers, ...emailLeads]) {
    if (contact.email) known.add(contact.email.trim().toLowerCase());
    if ("phone" in contact && contact.phone) known.add(contact.phone.replace(/\D/g, "").slice(-10));
  }
  const seen = new Set<string>();
  const counts = { events: events.length, recoverable: 0, duplicateOrKnown: 0, invalid: 0, imported: 0 };
  for (const event of events) {
    const data = event.meta as Record<string, unknown> | null;
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
    const phone = typeof data?.phone === "string" ? data.phone.replace(/\D/g, "").slice(-10) : "";
    if ((!email.includes("@") && phone.length !== 10) || /example\.|@test\.|audit|^test@/.test(email)) { counts.invalid++; continue; }
    const fingerprint = email || phone;
    if ([email, phone].filter(Boolean).some(value => seen.has(value) || known.has(value))) { counts.duplicateOrKnown++; continue; }
    if (email) seen.add(email);
    if (phone) seen.add(phone);
    counts.recoverable++;
    if (!apply) continue;
    const key = createHash("sha256").update(`wd-analytics-recovery:${fingerprint}`).digest("hex");
    await p.leadAction.upsert({ where: { requestKey: key }, update: {}, create: {
      requestKey: key, receiptToken: randomBytes(16).toString("base64url"), subsite: "wd",
      action: event.event === "lead_submit" ? "request_wd_quote" : "historical_email_capture",
      email: email || null, phone: phone || null, name: typeof data?.name === "string" ? data.name : null,
      structured: { ...data, importedFrom: event.id, originalEvent: event.event } as Prisma.InputJsonValue,
      createdAt: event.createdAt, status: "new",
      statusNote: "Recovered from analytics. Historical interest; verify contact and consent before follow-up. No notification sent.",
    } });
    counts.imported++;
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "review", ...counts }));
}
main().catch(() => { console.error("Recovery failed; verify database and migration."); process.exitCode = 1; }).finally(() => p.$disconnect());
