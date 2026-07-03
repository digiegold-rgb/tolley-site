import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // Search for Alexis anywhere
  const contacts = await prisma.accountContact.findMany({
    where: {
      OR: [
        { name: { contains: 'alexis', mode: 'insensitive' } },
        { email: { contains: 'alexis', mode: 'insensitive' } },
      ],
    },
  });
  console.log('CONTACTS w/ alexis:', JSON.stringify(contacts, null, 2));

  // All Buckeye-related contacts (full record, not just name/email)
  const buckeye = await prisma.accountContact.findMany({
    where: {
      OR: [
        { name: { contains: 'Buckeye', mode: 'insensitive' } },
        { email: { contains: 'buckeye', mode: 'insensitive' } },
      ],
    },
  });
  console.log('\nALL BUCKEYE CONTACTS (full):', JSON.stringify(buckeye, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
