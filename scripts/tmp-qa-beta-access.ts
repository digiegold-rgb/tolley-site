/**
 * One-off (2026-08-20): grant the walkthrough QA account beta access —
 * mints a QA-only BetaInvite (0 remaining uses, locked to the QA address)
 * and stamps termsVersion with the live TOS_VERSION so the click-wrap and
 * invite gates both pass for automated walkthroughs.
 */
import { prisma } from "../lib/prisma";
import { TOS_VERSION } from "../lib/legal-animate";

const EMAIL = "qa.walkthrough.0820@tolley.io";

async function main() {
  const invite = await prisma.betaInvite.upsert({
    where: { code: "QA-WALKTHROUGH-0820" },
    create: {
      code: "QA-WALKTHROUGH-0820",
      email: EMAIL,
      maxUses: 1,
      usedCount: 1,
      createdBy: "qa-harness",
      note: "Playwright walkthrough account — not a customer invite",
    },
    update: {},
  });
  const user = await prisma.user.update({
    where: { email: EMAIL },
    data: {
      betaInviteId: invite.id,
      termsAcceptedAt: new Date(),
      termsVersion: TOS_VERSION,
    },
  });
  console.log(`ok: ${user.email} invite=${invite.code} terms=${TOS_VERSION}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
