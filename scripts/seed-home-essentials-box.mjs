// Seed the REAL Home Essentials Box storefront — the Buckeye Cleaning
// ready-to-run business featured on /sales. Unlike demo-essentials-box this
// is a live, selling-enabled storefront (non-"demo-" slug → real Stripe
// subscription checkout). House-operated (bound to Jared's user so nobody
// can drive-by claim it) until someone takes it over: admin nulls userId,
// then hand them /signup?claim=home-essentials-box.
//
// Usage (from tolley-site/):
//   node --env-file=.env.local scripts/seed-home-essentials-box.mjs
//
// Idempotent: re-running upserts the same rows (fixed ids), no duplicates.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_EMAIL = "digiegold@gmail.com";
const OPERATOR_ID = "launchpad-essentials-operator";
const STOREFRONT_ID = "launchpad-essentials-storefront";
const SLUG = "home-essentials-box";
const PHONE = "913-283-3826";

// Offering names are the checkout lookup key (/api/biz/checkout matches by
// exact name) — adjust prices in /sales/portal, but don't rename casually.
const OFFERINGS = [
  {
    name: "Solo Box",
    desc: "Monthly essentials for one — paper towels, TP, hand soap, surface cleaner. Delivered to your door.",
    priceCents: 2900,
    kind: "monthly",
  },
  {
    name: "Family Box",
    desc: "Double the essentials for a full household — paper goods, soaps, cleaners — delivered monthly.",
    priceCents: 4900,
    kind: "monthly",
  },
  {
    name: "Deep Clean Box",
    desc: "The Family Box plus degreasers, disinfectant, and laundry — the works, every month.",
    priceCents: 7900,
    kind: "monthly",
  },
];

async function main() {
  // Bind to Jared's account so the claim flow can't be hijacked.
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  if (!owner) {
    console.warn(
      `⚠️  No user found for ${OWNER_EMAIL} — seeding UNBOUND. ` +
        `Anyone signed-in could claim this operator via /signup?claim=${SLUG}. ` +
        `Create the account and re-run to bind it.`,
    );
  }

  const operatorData = {
    slug: SLUG,
    name: "Tolley Home Essentials",
    email: OWNER_EMAIL,
    phone: PHONE,
    status: "approved",
    userId: owner?.id ?? null,
    termsAcceptedAt: new Date(),
    approvedAt: new Date(),
    notes:
      "House-run ready-to-run business (Buckeye Cleaning wholesale). Transfer: null userId, hand taker /signup?claim=home-essentials-box.",
  };
  await prisma.operator.upsert({
    where: { id: OPERATOR_ID },
    update: operatorData,
    create: { id: OPERATOR_ID, ...operatorData },
  });

  const storefrontData = {
    operatorId: OPERATOR_ID,
    slug: SLUG,
    businessName: "Home Essentials Box",
    category: "generic",
    tagline:
      "Household essentials at wholesale, delivered monthly — skip the store run.",
    about:
      "Paper towels, toilet paper, hand soap, and real cleaning chemicals — sourced through our Buckeye Cleaning wholesale account, packed into a monthly box, and delivered to your door in the KC metro. No membership card, no big-box markup, no Saturday errand. Pick a box, and it just shows up.",
    city: "Independence, MO",
    phone: PHONE,
    offerings: OFFERINGS,
    published: true,
    sellingEnabled: true,
  };
  await prisma.storefront.upsert({
    where: { id: STOREFRONT_ID },
    update: storefrontData,
    create: { id: STOREFRONT_ID, ...storefrontData },
  });

  // Launch-announcement draft for the /social queue (created here because the
  // storefront is seeded rather than provisioned). Draft-only — never posts
  // until Jared clicks Post now in /social.
  const existingDraft = await prisma.socialPost.findFirst({
    where: { source: "launchpad", sourceRefId: SLUG },
    select: { id: true },
  });
  if (!existingDraft) {
    await prisma.socialPost.create({
      data: {
        source: "launchpad",
        sourceRefId: SLUG,
        mediaUrl: `https://www.tolley.io/biz/${SLUG}/opengraph-image`,
        mediaType: "image",
        title: "New on The Launchpad: Home Essentials Box",
        caption:
          "Home Essentials Box (Independence, MO) just launched on The Launchpad.\n\n" +
          "Paper towels, TP, soap, and cleaners at wholesale — delivered monthly.\n\n" +
          `Check it out → https://www.tolley.io/biz/${SLUG}\n\n` +
          "Want your own? https://www.tolley.io/sales",
        hashtags: ["#launchpad", "#smallbusiness", "#kansascity"],
        platforms: ["facebook"],
        status: "draft",
      },
    });
    console.log("   social draft created (facebook, status=draft)");
  }

  console.log("✅ Home Essentials Box seeded:");
  console.log(`   storefront: /biz/${SLUG} (sellingEnabled=true, REAL Stripe checkout)`);
  console.log(`   operator bound to: ${owner ? OWNER_EMAIL : "NOBODY (⚠️ unbound)"}`);
  console.log(`   offerings: ${OFFERINGS.map((o) => `${o.name} $${o.priceCents / 100}/mo`).join(" · ")}`);
}

main()
  .catch((e) => {
    console.error("seed-home-essentials-box failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
