/**
 * Seed historical pool cost data from Investing.pdf "Pool Time" tab
 * and default config/inventory.
 *
 * Run: npx tsx prisma/seeds/water-seed.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding pool water management data...");

  // ─── Pool Config ──────────────────────────────────────────
  const configs = [
    { key: "pool_volume", value: "48000" },
    { key: "pool_type", value: "saltwater" },
    { key: "scg_model", value: "Pentair IntelliConnect" },
    { key: "sensor", value: "WaterGuru SENSE" },
    { key: "location_lat", value: "39.0911" },
    { key: "location_lng", value: "-94.4155" },
    { key: "location_city", value: "Independence, MO" },
  ];

  for (const c of configs) {
    await prisma.poolConfig.upsert({
      where: { key: c.key },
      update: { value: c.value },
      create: c,
    });
  }
  console.log(`  Config: ${configs.length} entries`);

  // ─── Historical Costs ─────────────────────────────────────
  const costs = [
    // Summer 2021 — Equipment
    { season: 2021, category: "equipment", item: "Pentir Multi Valve", amount: 204 },
    { season: 2021, category: "equipment", item: "Pool Set", amount: 1000 },
    { season: 2021, category: "equipment", item: "Deci-Lite Sand", amount: 400 },
    { season: 2021, category: "equipment", item: "Pool Hose", amount: 500 },
    { season: 2021, category: "equipment", item: "Copper Pipes", amount: 50 },
    { season: 2021, category: "equipment", item: "Below Cover", amount: 749 },
    { season: 2021, category: "equipment", item: "Solar Tool", amount: 239 },
    { season: 2021, category: "equipment", item: "Cover-set Bolts", amount: 800 },
    { season: 2021, category: "equipment", item: "Leaf Screen", amount: 25 },
    { season: 2021, category: "equipment", item: "Laterals", amount: 153 },
    { season: 2021, category: "equipment", item: "GE Automation", amount: 259 },
    { season: 2021, category: "equipment", item: "Leak Detection", amount: 400 },
    { season: 2021, category: "equipment", item: "USB", amount: 1400 },
    { season: 2021, category: "equipment", item: "Pipes and Parts", amount: 360 },
    { season: 2021, category: "equipment", item: "Water", amount: 232 },
    // Summer 2021 — Chemicals
    { season: 2021, category: "chemical", item: "Shock & Flock", amount: 877 },
    { season: 2021, category: "chemical", item: "Pool Salt", amount: 220, quantity: 45, unit: "bags" },
    { season: 2021, category: "chemical", item: "Conditioner", amount: 230 },
    { season: 2021, category: "chemical", item: "Chlorine", amount: 220 },
    { season: 2021, category: "chemical", item: "Muriatic Acid", amount: 180 },
    { season: 2021, category: "chemical", item: "Stabilizer Tablets", amount: 103 },
    // Summer 2021 — Repairs
    { season: 2021, category: "repair", item: "Scaleramp", amount: 235 },
    { season: 2021, category: "repair", item: "Jack Hammer", amount: 499 },
    { season: 2021, category: "repair", item: "Saw and Blade", amount: 130 },
    { season: 2021, category: "repair", item: "Acid", amount: 15 },
    { season: 2021, category: "repair", item: "Paint", amount: 240 },
    { season: 2021, category: "repair", item: "Hiring the Pool", amount: 215 },
    { season: 2021, category: "repair", item: "Hoses", amount: 116 },

    // Summer 2022
    { season: 2022, category: "chemical", item: "Sign", amount: 180 },
    { season: 2022, category: "chemical", item: "T-5 Bags", amount: 121 },
    { season: 2022, category: "chemical", item: "Chlorine", amount: 269 },
    { season: 2022, category: "chemical", item: "Conditioner", amount: 230 },
    { season: 2022, category: "chemical", item: "Acid", amount: 130 },
    { season: 2022, category: "chemical", item: "Pipe Addition", amount: 25 },
    { season: 2022, category: "chemical", item: "Muria Bars", amount: 50 },
    { season: 2022, category: "equipment", item: "PVC", amount: 80 },
    { season: 2022, category: "equipment", item: "Water Generator", amount: 400 },

    // Summer 2023
    { season: 2023, category: "equipment", item: "Salt Dumpers", amount: 1299 },
    { season: 2023, category: "equipment", item: "Power Supply", amount: 365 },
    { season: 2023, category: "equipment", item: "Solar Cover", amount: 300 },
    { season: 2023, category: "equipment", item: "Solar Stompers", amount: 500 },
    { season: 2023, category: "equipment", item: "3 Way Valve", amount: 55 },
    { season: 2023, category: "chemical", item: "1/1 Bits Bags", amount: 30 },
    { season: 2023, category: "chemical", item: "Blue and Pipes", amount: 25 },
    { season: 2023, category: "chemical", item: "Pond Edges", amount: 109, quantity: 2, unit: "gallons" },
    { season: 2023, category: "chemical", item: "Borax", amount: 22 },
    { season: 2023, category: "chemical", item: "50lbs Shock", amount: 390 },
    // Summer 2023 — Startup
    { season: 2023, category: "startup", item: "Salt", amount: 4, quantity: 45, unit: "bags" },
    { season: 2023, category: "startup", item: "Stabilizer", amount: 160 },
    { season: 2023, category: "startup", item: "Borax", amount: 6 },
    { season: 2023, category: "startup", item: "Muriatic Acid", amount: 26 },
    { season: 2023, category: "startup", item: "Shock", amount: 236, quantity: 12, unit: "lbs" },
    { season: 2023, category: "startup", item: "Water", amount: 233, quantity: 46000, unit: "gallons" },
    { season: 2023, category: "startup", item: "Pipe", amount: 55 },
    { season: 2023, category: "startup", item: "Roof Brackets", amount: 200 },

    // Summer 2024
    { season: 2024, category: "chemical", item: "Muriatic Acid", amount: 199 },
    { season: 2024, category: "chemical", item: "250lb Stabilizer", amount: 600 },
    { season: 2024, category: "equipment", item: "Solar Cover", amount: 829 },
    { season: 2024, category: "chemical", item: "10 Foot Pipe", amount: 209 },
    { season: 2024, category: "chemical", item: "Ph Up", amount: 350 },
    { season: 2024, category: "chemical", item: "Brackets", amount: 100 },
    { season: 2024, category: "chemical", item: "Adapters", amount: 50 },
    { season: 2024, category: "chemical", item: "Multi-port Adapters", amount: 200 },

    // Summer 2025 — Startup
    { season: 2025, category: "startup", item: "Salt", amount: 450, quantity: 63, unit: "bags" },
    { season: 2025, category: "startup", item: "Muriatic Acid", amount: 68, quantity: 12, unit: "gallons" },
    { season: 2025, category: "startup", item: "Water", amount: 220, quantity: 48000, unit: "gallons" },
    // Summer 2025 — Supplies
    { season: 2025, category: "chemical", item: "Muriatic Acid", amount: 105 },
    { season: 2025, category: "chemical", item: "150 Lbs of Baking Soda", amount: 150 },

    // Summer 2026 — Startup
    { season: 2026, category: "startup", item: "Salt", amount: 516, quantity: 63, unit: "bags" },
    { season: 2026, category: "startup", item: "Muriatic Acid", amount: 118, quantity: 12, unit: "gallons" },
    { season: 2026, category: "startup", item: "Water", amount: 220, quantity: 48000, unit: "gallons" },
    { season: 2026, category: "startup", item: "White Shock", amount: 144 },
    { season: 2026, category: "startup", item: "Stabilizer", amount: 60 },
    { season: 2026, category: "startup", item: "Tarp", amount: 75 },
    { season: 2026, category: "startup", item: "Net", amount: 14 },
  ];

  // Clear existing costs to avoid duplicates on re-run
  await prisma.poolCost.deleteMany();

  for (const c of costs) {
    await prisma.poolCost.create({
      data: {
        season: c.season,
        category: c.category,
        item: c.item,
        amount: c.amount,
        quantity: c.quantity ?? null,
        unit: c.unit ?? null,
        purchaseDate: new Date(`${c.season}-06-01`),
      },
    });
  }
  console.log(`  Costs: ${costs.length} entries seeded`);

  // ─── Default Inventory ────────────────────────────────────
  const inventory = [
    { item: "Pool Salt (40lb bag)", category: "salt", unit: "bags", lowStockThreshold: 5 },
    { item: "Muriatic Acid (1 gal)", category: "acid", unit: "gallons", lowStockThreshold: 2 },
    { item: "Stabilizer / CYA (4lb)", category: "stabilizer", unit: "lbs", lowStockThreshold: 4 },
    { item: "Cal-Hypo Shock (1lb)", category: "shock", unit: "lbs", lowStockThreshold: 5 },
    { item: "Baking Soda (12lb)", category: "soda", unit: "lbs", lowStockThreshold: 12 },
    { item: "Borax (4lb)", category: "borax", unit: "lbs", lowStockThreshold: 4 },
    { item: "Soda Ash / pH Up (5lb)", category: "other", unit: "lbs", lowStockThreshold: 5 },
  ];

  const existingInv = await prisma.poolInventory.count();
  if (existingInv === 0) {
    for (const inv of inventory) {
      await prisma.poolInventory.create({
        data: {
          item: inv.item,
          category: inv.category,
          unit: inv.unit,
          lowStockThreshold: inv.lowStockThreshold,
          quantity: 0,
          updatedAt: new Date(),
        },
      });
    }
    console.log(`  Inventory: ${inventory.length} items`);
  } else {
    console.log(`  Inventory: skipped (${existingInv} items exist)`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
