import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { customerCrmReferences } from "../lib/customer-crm-references";
import { customerLeads } from "../lib/customer-leads";
import { signMfaProof, verifyMfaProof } from "../lib/auth/mfa-proof";
import { analyticsSiteForPath } from "../lib/analytics-site";
import nodemailer from "nodemailer";
import { deepmerge } from "deepmerge-ts";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55438/tolley_revenue_test")) throw new Error("Isolated database required");
async function main() {
const key = crypto.randomUUID();
const a = customerLeads("security-a-" + key), b = customerLeads("security-b-" + key);
const ids: string[] = [];
try {
  const shared = await prisma.lead.create({ data: { notes: "operator secret", status: "closed", ownerName: "Source owner" } });
  const personal = await prisma.lead.create({ data: { ownerSubscriberId: "security-a-" + key, source: "fsbo_manual", notes: "A private" } });
  const orphan = await prisma.lead.create({ data: { source: "fsbo_manual", notes: "Legacy unassigned private note" } });
  ids.push(shared.id, personal.id, orphan.id);
  assert.equal((await a.findUnique({ where: { id: shared.id } }))?.notes, null);
  assert.equal((await a.findUnique({ where: { id: shared.id } }))?.status, "new");
  await a.update({ where: { id: shared.id }, data: { notes: "A notes", status: "contacted" } });
  await b.update({ where: { id: shared.id }, data: { notes: "B notes", status: "interested" } });
  assert.equal((await a.findUnique({ where: { id: shared.id } }))?.notes, "A notes");
  assert.equal((await b.findUnique({ where: { id: shared.id } }))?.notes, "B notes");
  assert.equal((await prisma.lead.findUniqueOrThrow({ where: { id: shared.id } })).notes, "operator secret");
  assert.equal(await a.count({ where: { id: shared.id, status: "contacted" } }), 1);
  assert.equal(await b.count({ where: { id: shared.id, status: "contacted" } }), 0);
  assert.equal(await b.findUnique({ where: { id: personal.id } }), null);
  assert.equal(await a.findUnique({ where: { id: orphan.id } }), null);
  await assert.rejects(b.update({ where: { id: personal.id }, data: { notes: "cross-customer write" } }));
  await assert.rejects(a.update({ where: { id: shared.id }, data: { score: 100 } }));
  assert.deepEqual(await a.findUnique({ where: { id: shared.id }, select: { status: true } }), { status: "contacted" });
  assert.equal(await customerCrmReferences("security-a-" + key, { leadId: personal.id }), true);
  assert.equal(await customerCrmReferences("security-b-" + key, { leadId: personal.id }), false);
  assert.equal(await customerCrmReferences("security-a-" + key, { leadId: { id: personal.id } }), false);
  assert.equal(await customerCrmReferences("security-a-" + key, { clientId: "missing-" + key }), false);
  assert.equal(await customerCrmReferences("security-a-" + key, { dealId: "missing-" + key }), false);
  assert.throws(() => a.deleteMany(), /Unsupported customer lead operation/);
  const issued = Date.now();
  const proof = signMfaProof("user-a", "session-a", "enrollment-a", issued);
  assert(verifyMfaProof(proof, "user-a", "session-a", "enrollment-a", issued));
  assert(!verifyMfaProof(proof, "user-b", "session-a", "enrollment-a", issued));
  assert(!verifyMfaProof(proof, "user-a", "session-b", "enrollment-a", issued));
  assert(!verifyMfaProof(proof, "user-a", "session-a", "enrollment-b", issued));
  assert(!verifyMfaProof(proof, "user-a", "session-a", "enrollment-a", issued + 13 * 3600000));
  assert(!verifyMfaProof(proof + "x", "user-a", "session-a", "enrollment-a", issued));
  assert.equal(analyticsSiteForPath("/animate"), "animate");
  assert.equal(analyticsSiteForPath("/wd/admin"), "wd");
  assert.equal(analyticsSiteForPath("/agent"), "agent");
  assert.equal(analyticsSiteForPath("/agents"), "agents");
  assert.equal(analyticsSiteForPath("/hq"), "hq");
  assert.equal(analyticsSiteForPath("/login/mfa-challenge"), null);
  assert.deepEqual(deepmerge({ a: { x: 1 } }, { a: { y: 2 } }), { a: { x: 1, y: 2 } });
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const mail = await transport.sendMail({ from: "sender@example.invalid", to: "recipient@example.invalid",
    subject: "Sign in test", text: "Local transport compatibility", html: "<p>Local transport compatibility</p>",
    disableFileAccess: true, disableUrlAccess: true });
  assert(String(mail.message).includes("Local transport compatibility"));
  console.log("PASS: customer isolation, private/manual visibility, scoped filters, MFA proof binding/expiry, route classification, patched merge/mail compatibility.");
} finally {
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
