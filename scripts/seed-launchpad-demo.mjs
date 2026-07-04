// Seed the Launchpad demo account + storefront so Cordless (and anyone he shares
// it with) can click the whole operator flow without touching real Stripe.
//
// Usage (from tolley-site/):
//   node --env-file=.env.local scripts/seed-launchpad-demo.mjs
//
// Creates:
//   - user demo@tolley.io / LaunchTheDemo!26 (scrypt hash — matches lib/password.ts + auth.ts)
//   - approved Operator + Storefront at /biz/demo-essentials-box (Essentials Box play)
//     sellingEnabled=true, BUT checkout returns a demo notice (slug starts "demo-")
//   - 3 seeded LaunchpadSale rows so the portal shows real-looking numbers
// Idempotent: re-running upserts the same rows (fixed ids), no duplicates.

import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

// Mirror of lib/password.ts hashPassword (scrypt, keylen 64, "salt:hex").
async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

const DEMO_EMAIL = "demo@tolley.io";
const DEMO_PASSWORD = "LaunchTheDemo!26";
const OPERATOR_ID = "launchpad-demo-operator";
const STOREFRONT_ID = "launchpad-demo-storefront";
const SLUG = "demo-essentials-box";

const OFFERINGS = [
  { name: "Monthly Essentials Box", desc: "Soap concentrate, paper towels, and TP delivered to your door every month.", priceCents: 4500, kind: "monthly" },
  { name: "One-Time Starter Box", desc: "Try it once — a full box of household essentials, no subscription.", priceCents: 3200, kind: "one_time" },
  { name: "Family Size Upgrade", desc: "Double the essentials for bigger households, billed monthly.", priceCents: 7500, kind: "monthly" },
];

const SALES = [
  { id: "launchpad-demo-sale-1", offeringName: "Monthly Essentials Box", amountCents: 4500, kind: "monthly", buyerName: "Marcus Reed", buyerEmail: "marcus.demo@example.com", daysAgo: 12 },
  { id: "launchpad-demo-sale-2", offeringName: "One-Time Starter Box", amountCents: 3200, kind: "one_time", buyerName: "Tanya Brooks", buyerEmail: "tanya.demo@example.com", daysAgo: 6 },
  { id: "launchpad-demo-sale-3", offeringName: "Family Size Upgrade", amountCents: 7500, kind: "monthly", buyerName: "The Nguyen Family", buyerEmail: "nguyen.demo@example.com", daysAgo: 2 },
];

async function main() {
  // 1) Demo user with credential auth (scrypt).
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Launchpad Demo Operator" },
    create: { email: DEMO_EMAIL, name: "Launchpad Demo Operator" },
  });

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.credentialAuth.upsert({
    where: { userId: user.id },
    update: { passwordHash },
    create: { userId: user.id, passwordHash },
  });

  // 2) Approved operator, claimed by the demo user.
  await prisma.operator.upsert({
    where: { id: OPERATOR_ID },
    update: {
      slug: SLUG,
      name: "Demo Operator",
      email: DEMO_EMAIL,
      phone: "816-555-0142",
      status: "approved",
      userId: user.id,
      termsAcceptedAt: new Date(),
      approvedAt: new Date(),
    },
    create: {
      id: OPERATOR_ID,
      slug: SLUG,
      name: "Demo Operator",
      email: DEMO_EMAIL,
      phone: "816-555-0142",
      status: "approved",
      userId: user.id,
      termsAcceptedAt: new Date(),
      approvedAt: new Date(),
    },
  });

  // 3) Live storefront (selling enabled — checkout is demo-gated by slug prefix).
  await prisma.storefront.upsert({
    where: { id: STOREFRONT_ID },
    update: {
      operatorId: OPERATOR_ID,
      slug: SLUG,
      businessName: "Ridgeline Essentials Box",
      category: "generic",
      tagline: "Household essentials, delivered monthly — no store run, no membership card.",
      about: "A neighbor-run subscription box: soap concentrate cut to size, paper towels off a wholesale pallet, and TP, delivered to your door every month. Sourced through Tolley's wholesale accounts, packed and delivered local.",
      city: "Independence, MO",
      phone: "816-555-0142",
      offerings: OFFERINGS,
      published: true,
      sellingEnabled: true,
    },
    create: {
      id: STOREFRONT_ID,
      operatorId: OPERATOR_ID,
      slug: SLUG,
      businessName: "Ridgeline Essentials Box",
      category: "generic",
      tagline: "Household essentials, delivered monthly — no store run, no membership card.",
      about: "A neighbor-run subscription box: soap concentrate cut to size, paper towels off a wholesale pallet, and TP, delivered to your door every month. Sourced through Tolley's wholesale accounts, packed and delivered local.",
      city: "Independence, MO",
      phone: "816-555-0142",
      offerings: OFFERINGS,
      published: true,
      sellingEnabled: true,
    },
  });

  // 4) Three seeded sales.
  for (const s of SALES) {
    const createdAt = new Date(Date.now() - s.daysAgo * 86400000);
    await prisma.launchpadSale.upsert({
      where: { id: s.id },
      update: {
        storefrontId: STOREFRONT_ID,
        offeringName: s.offeringName,
        amountCents: s.amountCents,
        kind: s.kind,
        stripeSessionId: `demo_${s.id}`,
        buyerName: s.buyerName,
        buyerEmail: s.buyerEmail,
        createdAt,
      },
      create: {
        id: s.id,
        storefrontId: STOREFRONT_ID,
        offeringName: s.offeringName,
        amountCents: s.amountCents,
        kind: s.kind,
        stripeSessionId: `demo_${s.id}`,
        buyerName: s.buyerName,
        buyerEmail: s.buyerEmail,
        createdAt,
      },
    });
  }

  console.log("✅ Launchpad demo seeded:");
  console.log(`   login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   storefront: /biz/${SLUG}`);
  console.log(`   portal: /sales/portal  ·  sales: ${SALES.length}`);
}

main()
  .catch((e) => {
    console.error("seed-launchpad-demo failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
