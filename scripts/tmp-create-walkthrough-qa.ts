/**
 * One-off (2026-08-20): fresh QA account for Playwright walkthroughs of the
 * /animate studio (escape-hatch regression tests). Terms pre-accepted so the
 * click-wrap doesn't block automated runs. Idempotent — reuses the row and
 * resets the password if it already exists.
 *
 * Usage: WALKTHROUGH_QA_PASSWORD=<pw> npx tsx scripts/tmp-create-walkthrough-qa.ts
 */
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

const EMAIL = "qa.walkthrough.0820@tolley.io";

async function main() {
  const password = process.env.WALKTHROUGH_QA_PASSWORD;
  if (!password) throw new Error("Set WALKTHROUGH_QA_PASSWORD");
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      name: "QA Walkthrough",
      termsAcceptedAt: new Date(),
      termsVersion: "qa",
    },
    update: {},
  });
  await prisma.credentialAuth.upsert({
    where: { userId: user.id },
    create: { userId: user.id, passwordHash },
    update: { passwordHash },
  });
  console.log(`ready: ${EMAIL} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
