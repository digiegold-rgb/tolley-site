import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { signMfaProof, enrollmentKey } from "../../lib/auth/mfa-proof";
import { createLead, agreementFor } from "../../lib/laundry/store";
const base = "http://127.0.0.1:3065";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55465/tolley_laundry_test"))
  throw new Error("Local test database required");
process.env.AUTH_SECRET = "laundry-test-secret-only";
async function session(admin = false) {
  let id = randomUUID();
  const email = admin
      ? "laundry-admin@example.invalid"
      : `${id}@example.invalid`,
    sid = randomUUID();
  const user = await prisma.user.upsert({
    where: { email },
    create: { id, email, name: "Laundry Test Account" },
    update: {},
  });
  id = user.id;
  const jwt = await encode({
    secret: process.env.AUTH_SECRET!,
    salt: "authjs.session-token",
    token: {
      sub: id,
      email,
      name: "Laundry Test Account",
      authSessionId: sid,
      sv: 0,
      svAt: Math.floor(Date.now() / 1000),
    },
  });
  const cookie = `authjs.session-token=${jwt}`;
  if (!admin) return { id, email, cookie };
  const mfa = await prisma.userMfa.upsert({
    where: { userId: id },
    update: {},
    create: {
      userId: id,
      totpSecret: "isolated-test-enrollment",
      verified: true,
      enabledAt: new Date(),
    },
  });
  return {
    id,
    email,
    cookie: `${cookie}; tolley_mfa=${signMfaProof(id, sid, enrollmentKey(mfa))}`,
    withoutMfa: cookie,
  };
}
async function api(
  cookie: string,
  path: string,
  data?: unknown,
  origin = base,
) {
  return fetch(base + path, {
    method: data ? "POST" : "GET",
    headers: {
      cookie,
      Origin: origin,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
async function main() {
  const a = await session(),
    b = await session(),
    owner = await session(true);
  const application = {
    name: "Access Test " + a.id.slice(0, 6),
    legalName: "Access Test LLC",
    phone: "9135550133",
    address: "Test address 123",
    zip: "66212",
    zips: ["66212"],
    radiusMiles: 0,
    description: "An isolated operator access test listing.",
    prices: { set: 5000 },
    deliveryFeeCents: 0,
    rentalTerms:
      "Monthly rental. Maintenance included. Cancel before the next month. Existing hookups required.",
    termsAccepted: true,
  };
  let r = await api(a.cookie, "/api/laundry/operators", application);
  assert.equal(r.status, 200, await r.text());
  const op = await prisma.laundryOperator.findUniqueOrThrow({
    where: { ownerId: a.id },
  });
  r = await api(b.cookie, "/api/laundry/operators", {
    ...application,
    id: op.id,
  });
  assert.equal(r.status, 404);
  r = await api(a.cookie, "/api/laundry/action", {
    action: "approve",
    id: op.id,
  });
  assert.equal(r.status, 403);
  r = await api(owner.withoutMfa!, "/api/laundry/dashboard");
  assert.equal(r.status, 401);
  await prisma.laundryOperator.update({
    where: { id: op.id },
    data: { paymentMethodId: "pm_access_test" },
  });
  r = await api(owner.cookie, "/api/laundry/action", {
    action: "approve",
    id: op.id,
  });
  assert.equal(r.status, 200, await r.text());
  const ag = await agreementFor(op.id, "set");
  const lead = await createLead({
    requestKey: randomUUID(),
    operatorId: op.id,
    name: "Access Renter",
    phone: "9135550134",
    email: "access-renter@example.invalid",
    address: "123 Private Test " + a.id,
    zip: "66212",
    unit: "set",
    preferredDate: new Date(Date.now() + 4 * 86400000)
      .toISOString()
      .slice(0, 10),
    notes: "",
    smsConsent: false,
    termsAccepted: true,
    signedName: "Access Renter",
    agreementHash: ag.hash,
  });
  r = await api(b.cookie, "/api/laundry/dashboard");
  assert.equal(r.status, 200);
  assert.ok(!(await r.text()).includes(lead.id));
  r = await api(b.cookie, "/api/laundry/action", {
    action: "accept",
    id: lead.id,
  });
  assert.equal(r.status, 404);
  r = await api(
    a.cookie,
    "/api/laundry/action",
    { action: "accept", id: lead.id },
    "https://evil.example",
  );
  assert.equal(r.status, 403);
  r = await api(a.cookie, "/api/laundry/action", {
    action: "accept",
    id: lead.id,
  });
  assert.equal(r.status, 200, await r.text());
  r = await api(a.cookie, "/api/laundry/action", {
    action: "confirm",
    id: lead.id,
    value: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
  });
  assert.equal(r.status, 409); // Billing deliberately disabled in this app.
  r = await api(owner.cookie, "/api/laundry/dashboard");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).admin, true);
  assert.equal(
    (await fetch(base + "/api/laundry/webhook", { method: "POST", body: "{}" }))
      .status,
    503,
  );
  assert.equal(
    (
      await fetch(base + "/api/laundry/sms", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "From=%2B19135550133&Body=hello",
      })
    ).status,
    403,
  );
  assert.equal((await fetch(base + "/api/cron/laundry")).status, 401);
  await prisma.laundryOperator.update({
    where: { id: op.id },
    data: { status: "paused" },
  });
  console.log(
    "PASS real session/MFA gates, operator onboarding/approval, tenant read/write isolation, CSRF, disabled billing, unsigned webhooks, and cron authorization.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
