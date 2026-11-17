import { seedAnchor } from "../lib/laundry/store";
import { prisma } from "../lib/prisma";
seedAnchor()
  .then((op) => console.log(`Laundry anchor ready: ${op.slug}`))
  .finally(() => prisma.$disconnect());
