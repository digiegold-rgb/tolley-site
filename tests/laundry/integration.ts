import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { getStripeClient } from "../../lib/stripe";
import {
  seedAnchor,
  agreementFor,
  createLead,
  leadAction,
  joinOperator,
  editOperator,
  publicOperators,
  receiptToken,
  verifyReceipt,
  renterAction,
} from "../../lib/laundry/store";
import { settleBooking, saveSetup } from "../../lib/laundry/billing";
import { runLaundryWorker } from "../../lib/laundry/worker";
import { covers, zipPlace, searchPlaces } from "../../lib/laundry/geo";
import { CONSENT_VERSION } from "../../lib/laundry/config";
if (!process.env.DATABASE_URL?.includes("127.0.0.1:55465/tolley_laundry_test"))
  throw new Error("Disposable laundry test database required");
process.env.AUTH_SECRET = "laundry-test-secret-only";
process.env.STRIPE_SECRET_KEY = "sk_test_laundry_stub";
process.env.LAUNDRY_NOTIFICATIONS_ENABLED = "false";
process.env.LAUNDRY_BILLING_ENABLED = "true";
const key = randomUUID(),
  owner = {
    id: `operator-${key}`,
    email: `${key}@example.invalid`,
    admin: false,
  },
  stranger = {
    id: "stranger",
    email: "stranger@example.invalid",
    admin: false,
  },
  admin = { id: "test-admin", email: "admin@example.invalid", admin: true };
const day = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const application = {
  name: "Test Rental " + key.slice(0, 6),
  legalName: "Test Rental LLC",
  phone: "9135550123",
  address: "100 Test Street, Test City",
  zip: "66212",
  zips: ["66212"],
  radiusMiles: 0,
  description: "Local test operator with verified test equipment.",
  prices: { set: 6000 },
  deliveryFeeCents: 2500,
  rentalTerms:
    "Month-to-month rental. Maintenance included. Rent paid monthly to operator. Cancel before renewal. Existing hookups required.",
  termsAccepted: true,
  websiteRequested: false,
};
let assertions = 0;
function ok(v: unknown) {
  assert.ok(v);
  assertions++;
}
async function rejects(fn: () => Promise<unknown>, pattern?: RegExp) {
  await assert.rejects(fn, pattern);
  assertions++;
}
async function request(operatorId: string | null, zip = "66212") {
  const agreement = operatorId ? await agreementFor(operatorId, "set") : null;
  return {
    requestKey: randomUUID(),
    operatorId,
    name: "Test Renter",
    phone: "9135550124",
    email: "renter@example.invalid",
    address: `200 Test Street ${randomUUID()}`,
    zip,
    unit: "set",
    preferredDate: day,
    notes: "Existing hookups; ground floor",
    smsConsent: true,
    termsAccepted: true,
    signedName: operatorId ? "Test Renter" : "",
    agreementHash: agreement?.hash || "",
    attribution: {
      campaignSource: "search",
      referrerHost: "chatgpt.com",
      reportedSource: "Friend",
      landingPath: "/laundry",
      version: 1,
    },
  };
}
async function main() {
  ok(zipPlace("64111")?.state === "MO");
  ok(searchPlaces("Overland Park, KS").some((p) => p.zip === "66212"));
  ok(covers({ zip: "64111", zips: [], radiusMiles: 30 }, "66212"));
  ok(!covers({ zip: "64111", zips: ["64111"], radiusMiles: 200 }, "66212"));
  const anchor = await seedAnchor();
  ok(anchor.feeCents === 0);
  const op = await joinOperator(owner, application);
  ok(op.status === "pending");
  ok(!(await publicOperators("66212")).some((x) => x.id === op.id));
  await rejects(() => editOperator(stranger, op.id, application), /not found/);
  await prisma.laundryOperator.update({
    where: { id: op.id },
    data: {
      status: "approved",
      stripeCustomerId: `cus_${key}`,
      paymentMethodId: `pm_${key}`,
    },
  });
  ok((await publicOperators("66212")).some((x) => x.id === op.id));
  const b = await request(op.id);
  await rejects(() => createLead({ ...b, zip: "99501" }), /does not serve/);
  await rejects(
    () => createLead({ ...b, agreementHash: "stale" }),
    /terms changed/,
  );
  await rejects(
    () => createLead({ ...b, signedName: "Someone Else" }),
    /full name/,
  );
  await rejects(() => createLead({ ...b, preferredDate: "2026-02-31" }));
  const results = await Promise.all([
    createLead(b),
    createLead(b),
    createLead(b),
  ]);
  ok(results.every((r) => r.id === results[0].id));
  const id = results[0].id;
  await rejects(
    () => createLead({ ...b, requestKey: randomUUID() }),
    /active request already exists/,
  );
  ok(
    (await prisma.laundryLead.count({
      where: { requestKey: b.requestKey },
    })) === 1,
  );
  await rejects(
    () => createLead({ ...b, email: "other@example.invalid" }),
    /already used/,
  );
  ok(verifyReceipt(id, receiptToken(id)));
  ok(!verifyReceipt(id, "0".repeat(64)));
  const saved = await prisma.laundryLead.findUniqueOrThrow({ where: { id } });
  ok(saved.signedAt && saved.agreementText?.includes("$60"));
  ok(saved.consentVersion === CONSENT_VERSION);
  ok(
    (saved.attribution as { reportedSource: string }).reportedSource ===
      "Friend",
  );
  await rejects(() => leadAction(stranger, id, "accept"), /not found/);
  await rejects(() => leadAction(owner, id, "confirm", day), /Accept a signed/);
  await leadAction(owner, id, "accept");
  ok((await prisma.laundryBooking.count({ where: { leadId: id } })) === 0);
  await Promise.all([
    leadAction(owner, id, "confirm", day),
    leadAction(owner, id, "confirm", day),
  ]);
  const booking = await prisma.laundryBooking.findUniqueOrThrow({
    where: { leadId: id },
  });
  ok(booking.feeCents === 4500);
  ok((await prisma.laundryBooking.count({ where: { leadId: id } })) === 1);
  const stripe = getStripeClient(),
    intents = new Map<string, any>(),
    refunds = new Map<string, any>();
  let creates = 0,
    charges = 0,
    refundCount = 0;
  stripe.paymentIntents.create = (async (p: any) => {
    creates++;
    const pi = {
      id: `pi_${creates}_${key}`,
      metadata: p.metadata,
      amount: p.amount,
      currency: p.currency,
      status: "requires_confirmation",
    };
    intents.set(pi.id, pi);
    return pi;
  }) as any;
  stripe.paymentIntents.retrieve = (async (id: string) => ({
    ...intents.get(id),
  })) as any;
  stripe.paymentIntents.confirm = (async (id: string) => {
    const pi = intents.get(id);
    if (pi.status !== "succeeded") charges++;
    pi.status = "succeeded";
    return { ...pi };
  }) as any;
  stripe.paymentIntents.cancel = (async (id: string) => {
    const pi = intents.get(id);
    pi.status = "canceled";
    return { ...pi };
  }) as any;
  stripe.refunds.create = (async (p: any) => {
    refundCount++;
    const r = { id: `re_${key}`, status: "succeeded" };
    refunds.set(r.id, r);
    return r;
  }) as any;
  stripe.refunds.retrieve = (async (id: string) => refunds.get(id)) as any;
  await Promise.all([settleBooking(booking.id), settleBooking(booking.id)]);
  ok(creates === 1 && charges === 1);
  await settleBooking(booking.id);
  ok(charges === 1);
  ok(
    (
      await prisma.laundryBooking.findUniqueOrThrow({
        where: { id: booking.id },
      })
    ).status === "paid",
  );
  const nextDay = new Date(Date.now() + 5 * 86400000)
    .toISOString()
    .slice(0, 10);
  await leadAction(owner, id, "reschedule", nextDay);
  await settleBooking(booking.id);
  ok(charges === 1);
  await leadAction(owner, id, "cancel");
  await settleBooking(booking.id);
  await settleBooking(booking.id);
  ok(refundCount === 1);
  ok(
    (
      await prisma.laundryBooking.findUniqueOrThrow({
        where: { id: booking.id },
      })
    ).status === "refunded",
  );
  const free = await createLead(await request(anchor.id));
  await leadAction(admin, free.id, "accept");
  await leadAction(admin, free.id, "confirm", day);
  ok(
    (
      await prisma.laundryBooking.findUniqueOrThrow({
        where: { leadId: free.id },
      })
    ).status === "waived",
  );
  await leadAction(admin, free.id, "delivered");
  await renterAction(free.id, receiptToken(free.id), "review", {
    rating: 1,
    body: "Installation was delayed and communication could improve.",
  });
  ok(
    (
      await prisma.laundryReview.findUniqueOrThrow({
        where: { leadId: free.id },
      })
    ).status === "published",
  );
  await rejects(
    () =>
      renterAction(id, receiptToken(id), "review", {
        rating: 5,
        body: "An invalid review before delivery.",
      }),
    /after delivery/,
  );
  const reroute = await createLead(await request(op.id));
  await leadAction(owner, reroute.id, "decline");
  const agreement = await agreementFor(anchor.id, "set");
  await renterAction(reroute.id, receiptToken(reroute.id), "reassign", {
    operatorId: anchor.id,
    agreementHash: agreement.hash,
    signedName: "Test Renter",
    termsAccepted: true,
  });
  await rejects(() => leadAction(owner, reroute.id, "accept"), /not found/);
  ok(
    (
      await prisma.laundryEvent.findFirstOrThrow({
        where: { leadId: reroute.id, action: "reassigned" },
      })
    ).detail.includes("previousAgreement"),
  );
  const expired = await createLead(await request(op.id));
  await prisma.laundryLead.update({
    where: { id: expired.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await runLaundryWorker();
  ok(
    (await prisma.laundryLead.findUniqueOrThrow({ where: { id: expired.id } }))
      .status === "expired",
  );
  await rejects(() => leadAction(owner, expired.id, "accept"), /no longer/);
  const wait = await createLead(await request(null, "99501"));
  ok(
    (await prisma.laundryLead.findUniqueOrThrow({ where: { id: wait.id } }))
      .operatorId === null,
  );
  await editOperator(owner, op.id, { ...application, prices: { set: 7000 } });
  ok(
    (await prisma.laundryOperator.findUniqueOrThrow({ where: { id: op.id } }))
      .status === "pending",
  );
  ok(
    (
      await prisma.laundryLead.findUniqueOrThrow({ where: { id } })
    ).agreementText?.includes("$60"),
  );
  ok(
    (await prisma.laundryNotification.count({
      where: { id: { startsWith: id + ":created" } },
    })) === 2,
  );
  // Card setup webhook replay must not replace a newer saved card.
  stripe.setupIntents.retrieve = (async (setupId: string) => ({
    status: "succeeded",
    customer: `cus_${key}`,
    payment_method: setupId === "seti_new" ? "pm_new" : "pm_old",
  })) as any;
  const setupSession = {
    metadata: { product: "laundry-marketplace", operatorId: op.id },
    mode: "setup",
    status: "complete",
    customer: `cus_${key}`,
    setup_intent: "seti_new",
    created: 2000,
  } as any;
  await saveSetup(setupSession);
  await saveSetup({ ...setupSession, setup_intent: "seti_old", created: 1000 });
  ok(
    (await prisma.laundryOperator.findUniqueOrThrow({ where: { id: op.id } }))
      .paymentMethodId === "pm_new",
  );
  // Declined-card recovery reuses the existing intent.
  await prisma.laundryOperator.update({
    where: { id: op.id },
    data: { status: "approved" },
  });
  const failedLead = await createLead(await request(op.id));
  await leadAction(owner, failedLead.id, "accept");
  await leadAction(owner, failedLead.id, "confirm", day);
  const failedBooking = await prisma.laundryBooking.findUniqueOrThrow({
    where: { leadId: failedLead.id },
  });
  const goodConfirm = stripe.paymentIntents.confirm;
  stripe.paymentIntents.confirm = (async (piId: string) => {
    intents.get(piId).status = "requires_payment_method";
    throw new Error("test decline");
  }) as any;
  await settleBooking(failedBooking.id);
  const failed = await prisma.laundryBooking.findUniqueOrThrow({
    where: { id: failedBooking.id },
  });
  ok(failed.status === "payment_failed" && !!failed.paymentIntentId);
  stripe.paymentIntents.confirm = goodConfirm;
  await settleBooking(failedBooking.id);
  const recovered = await prisma.laundryBooking.findUniqueOrThrow({
    where: { id: failedBooking.id },
  });
  ok(
    recovered.status === "paid" &&
      recovered.paymentIntentId === failed.paymentIntentId,
  );
  // An unpaid cancellation never creates a charge.
  const voidLead = await createLead(await request(op.id));
  await leadAction(owner, voidLead.id, "accept");
  await leadAction(owner, voidLead.id, "confirm", day);
  await leadAction(owner, voidLead.id, "cancel");
  const voidBooking = await prisma.laundryBooking.findUniqueOrThrow({
      where: { leadId: voidLead.id },
    }),
    beforeCreates = creates;
  await settleBooking(voidBooking.id);
  ok(
    creates === beforeCreates &&
      (
        await prisma.laundryBooking.findUniqueOrThrow({
          where: { id: voidBooking.id },
        })
      ).status === "void",
  );
  // Keep repeatable tests out of the public listing screenshots.
  await prisma.laundryOperator.update({
    where: { id: op.id },
    data: { status: "paused" },
  });
  console.log(
    `PASS ${assertions} assertions: national coverage, idempotent intake/charges/refunds, signed snapshots, tenant isolation, zero-fee anchor, expiry/reassignment, negative reviews, consent and durable notifications.`,
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
