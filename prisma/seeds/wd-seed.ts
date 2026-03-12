import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedClient {
  name: string;
  address?: string;
  unitDescription: string;
  unitCost?: number;
  installDate?: string;
  active?: boolean;
  needsReview?: boolean;
  notes?: string;
  payments?: { amount: number; month: string; note?: string }[];
}

// All 35 existing clients — all Tolley-sourced, Tolley-paid
const clients: SeedClient[] = [
  { name: "Aaron", address: "1234 E 15th St", unitDescription: "Whirlpool W & Amana D", payments: [
    { amount: 58, month: "2025-01" }, { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" },
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "April", address: "2301 S Crysler Ave", unitDescription: "Samsung W & Samsung D", payments: [
    { amount: 42, month: "2025-03" }, { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" },
    { amount: 42, month: "2025-06" }, { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
  ]},
  { name: "Betty", address: "3400 S Peck Ave", unitDescription: "LG W & LG D", payments: [
    { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" }, { amount: 58, month: "2025-04" },
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Brandy", address: "4501 E 12th St", unitDescription: "Maytag W & Maytag D", payments: [
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" },
  ]},
  { name: "Carla", address: "5100 E 10th St S", unitDescription: "Whirlpool W & Whirlpool D", payments: [
    { amount: 42, month: "2025-01" }, { amount: 42, month: "2025-02" }, { amount: 42, month: "2025-03" },
    { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" }, { amount: 42, month: "2025-06" },
    { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" }, { amount: 42, month: "2025-09" },
  ]},
  { name: "Carlos", address: "1800 N Sterling Ave", unitDescription: "Amana W & Amana D", payments: [
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Chris", address: "2600 S Hardy Ave", unitDescription: "GE W & GE D", payments: [
    { amount: 42, month: "2025-06" }, { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
    { amount: 42, month: "2025-09" },
  ]},
  { name: "Crystal", address: "900 W Walnut St", unitDescription: "Samsung W & Whirlpool D", payments: [
    { amount: 58, month: "2025-03" }, { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" },
    { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" },
    { amount: 58, month: "2025-09" },
  ]},
  { name: "Danielle", address: "3200 S River Blvd", unitDescription: "LG W & Samsung D", payments: [
    { amount: 58, month: "2025-01" }, { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" },
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" },
  ]},
  { name: "David", address: "4100 E 23rd St S", unitDescription: "Whirlpool W & GE D", payments: [
    { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" }, { amount: 42, month: "2025-06" },
    { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" }, { amount: 42, month: "2025-09" },
  ]},
  { name: "Debra", address: "1500 E Truman Rd", unitDescription: "Maytag W & Amana D", payments: [
    { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" }, { amount: 58, month: "2025-04" },
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Donna", address: "2800 S Lee's Summit Rd", unitDescription: "Samsung W & Samsung D", payments: [
    { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" }, { amount: 42, month: "2025-09" },
  ]},
  { name: "Eric", address: "3500 E 31st St S", unitDescription: "Whirlpool W & Whirlpool D", payments: [
    { amount: 58, month: "2025-01" }, { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" },
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Gloria", address: "700 N Noland Rd", unitDescription: "LG W & LG D", payments: [
    { amount: 42, month: "2025-02" }, { amount: 42, month: "2025-03" }, { amount: 42, month: "2025-04" },
    { amount: 42, month: "2025-05" }, { amount: 42, month: "2025-06" }, { amount: 42, month: "2025-07" },
    { amount: 42, month: "2025-08" }, { amount: 42, month: "2025-09" },
  ]},
  { name: "Jackie", address: "2100 E 39th St", unitDescription: "Amana W & Maytag D", payments: [
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" },
  ]},
  { name: "James", address: "1100 S Sterling Ave", unitDescription: "GE W & Whirlpool D", payments: [
    { amount: 42, month: "2025-03" }, { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" },
    { amount: 42, month: "2025-06" }, { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
    { amount: 42, month: "2025-09" },
  ]},
  { name: "Jennifer", address: "4400 S Overton Ave", unitDescription: "Samsung W & Amana D", payments: [
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "John", address: "3300 E 24th St", unitDescription: "Whirlpool W & Samsung D", payments: [
    { amount: 58, month: "2025-01" }, { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" },
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" },
  ]},
  { name: "Karen", address: "600 E Lexington Ave", unitDescription: "Maytag W & GE D", payments: [
    { amount: 42, month: "2025-06" }, { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
    { amount: 42, month: "2025-09" },
  ]},
  { name: "Kevin", address: "2500 N Delaware Ave", unitDescription: "LG W & Whirlpool D", payments: [
    { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" }, { amount: 58, month: "2025-04" },
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Linda", address: "1700 S Hocker Ave", unitDescription: "Amana W & Samsung D", payments: [
    { amount: 42, month: "2025-01" }, { amount: 42, month: "2025-02" }, { amount: 42, month: "2025-03" },
    { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" }, { amount: 42, month: "2025-06" },
    { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
  ]},
  { name: "Maria", address: "3800 E 17th St S", unitDescription: "GE W & LG D", payments: [
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Mark", address: "900 S Northern Blvd", unitDescription: "Samsung W & Maytag D", payments: [
    { amount: 42, month: "2025-03" }, { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" },
    { amount: 42, month: "2025-06" }, { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
  ]},
  { name: "Michelle", address: "2200 E 27th St", unitDescription: "Whirlpool W & Amana D", payments: [
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Nicole", address: "4200 S Osage Ave", unitDescription: "LG W & GE D", payments: [
    { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" }, { amount: 42, month: "2025-09" },
  ]},
  { name: "Patricia", address: "1300 W Maple Ave", unitDescription: "Maytag W & Whirlpool D", payments: [
    { amount: 58, month: "2025-01" }, { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" },
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Rachel", address: "3600 E 11th St", unitDescription: "Amana W & LG D", payments: [
    { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" }, { amount: 42, month: "2025-06" },
    { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
  ]},
  { name: "Robert", address: "500 N Spring St", unitDescription: "GE W & Samsung D", payments: [
    { amount: 58, month: "2025-02" }, { amount: 58, month: "2025-03" }, { amount: 58, month: "2025-04" },
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" },
  ]},
  { name: "Sandra", address: "2900 S Claremont Ave", unitDescription: "Samsung W & Whirlpool D", payments: [
    { amount: 42, month: "2025-06" }, { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" },
    { amount: 42, month: "2025-09" },
  ]},
  { name: "Sharon", address: "1600 E Pacific Ave", unitDescription: "Whirlpool W & Maytag D", payments: [
    { amount: 58, month: "2025-03" }, { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" },
    { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" },
    { amount: 58, month: "2025-09" },
  ]},
  // Duplicate Tae — seeded with needsReview: true
  { name: "Tae", address: "18949 E Tepee Ct", unitDescription: "LG W & Amana D", needsReview: true, payments: [
    { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" }, { amount: 58, month: "2025-07" },
    { amount: 58, month: "2025-08" },
  ]},
  { name: "Tae", address: "18949 E Tepee Ct", unitDescription: "LG W & Amana D (dup?)", needsReview: true, notes: "Possible duplicate — verify with original", payments: [
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" },
  ]},
  { name: "Teresa", address: "4000 E 35th St S", unitDescription: "Maytag W & Samsung D", payments: [
    { amount: 42, month: "2025-01" }, { amount: 42, month: "2025-02" }, { amount: 42, month: "2025-03" },
    { amount: 42, month: "2025-04" }, { amount: 42, month: "2025-05" }, { amount: 42, month: "2025-06" },
    { amount: 42, month: "2025-07" }, { amount: 42, month: "2025-08" }, { amount: 42, month: "2025-09" },
  ]},
  { name: "Victor", address: "1900 N Ralston Ave", unitDescription: "Amana W & GE D", payments: [
    { amount: 58, month: "2025-04" }, { amount: 58, month: "2025-05" }, { amount: 58, month: "2025-06" },
    { amount: 58, month: "2025-07" }, { amount: 58, month: "2025-08" }, { amount: 58, month: "2025-09" },
  ]},
  { name: "Wendy", address: "3100 S Willis Ave", unitDescription: "GE W & Maytag D", payments: [
    { amount: 42, month: "2025-08" }, { amount: 42, month: "2025-09" },
  ]},
];

async function main() {
  console.log("Seeding WD clients...");

  for (const c of clients) {
    // Idempotent: check by name + address + unitDescription
    const existing = await prisma.wdClient.findFirst({
      where: {
        name: c.name,
        address: c.address || null,
        unitDescription: c.unitDescription,
      },
    });

    if (existing) {
      console.log(`  Skip (exists): ${c.name} - ${c.unitDescription}`);
      continue;
    }

    const client = await prisma.wdClient.create({
      data: {
        name: c.name,
        address: c.address || null,
        unitDescription: c.unitDescription,
        unitCost: c.unitCost ?? 200,
        installDate: c.installDate ? new Date(c.installDate) : null,
        active: c.active ?? true,
        needsReview: c.needsReview ?? false,
        notes: c.notes || null,
        source: "tolley",
        paidBy: "tolley",
        blockedFields: ["address", "phone", "email", "notes"],
        photoUrls: [],
        receiptUrls: [],
      },
    });

    // Add payments
    if (c.payments?.length) {
      await prisma.wdPayment.createMany({
        data: c.payments.map((p) => ({
          clientId: client.id,
          amount: p.amount,
          month: p.month,
          note: p.note || null,
        })),
      });
    }

    console.log(`  Created: ${c.name} (${c.payments?.length || 0} payments)`);
  }

  const count = await prisma.wdClient.count();
  console.log(`\nDone. Total WD clients: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
