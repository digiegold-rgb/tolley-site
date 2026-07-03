/**
 * Seed default budget categories for the admin user.
 * Run: npx tsx scripts/budget-seed-categories.ts
 */
import { prisma } from "@/lib/prisma";
import { DEFAULT_BUDGET_CATEGORIES } from "@/lib/budget/seed";

async function main() {
  const adminEmail = (process.env.VATER_ADMIN_ALLOWLIST_EMAILS || process.env.ADMIN_ALLOWLIST_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)[0];

  if (!adminEmail) {
    console.error("No admin email found in VATER_ADMIN_ALLOWLIST_EMAILS or ADMIN_ALLOWLIST_EMAILS");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!user) {
    console.error(`No user found for email ${adminEmail}`);
    process.exit(1);
  }

  let created = 0;
  let updated = 0;
  for (const cat of DEFAULT_BUDGET_CATEGORIES) {
    const result = await prisma.budgetCategory.upsert({
      where: { userId_slug: { userId: user.id, slug: cat.slug } },
      create: { ...cat, userId: user.id },
      update: { name: cat.name, color: cat.color, icon: cat.icon, sortOrder: cat.sortOrder },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`Seed complete for ${adminEmail}: ${created} created, ${updated} updated.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
