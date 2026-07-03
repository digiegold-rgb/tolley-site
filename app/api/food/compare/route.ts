import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const STORE_ALIASES: Record<string, "walmart" | "samsclub"> = {
  walmart: "walmart",
  "walmart.com": "walmart",
  "sam's club": "samsclub",
  "sams club": "samsclub",
  samsclub: "samsclub",
  "samsclub.com": "samsclub",
};

function bucketStore(raw: string | null): "walmart" | "samsclub" | null {
  if (!raw) return null;
  return STORE_ALIASES[raw.trim().toLowerCase()] ?? null;
}

interface CompareRow {
  normalizedName: string;
  displayName: string;
  walmartPrice: number | null;
  samsPrice: number | null;
  recentBuys: number;
  winner: "walmart" | "samsclub" | "tie" | null;
  savingsPerUnit: number | null;
  estimatedAnnualSavings: number;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const entries = await prisma.foodPriceEntry.findMany({
    where: { householdId: household.id },
    select: {
      itemName: true,
      normalizedName: true,
      store: true,
      price: true,
      pricePerUnit: true,
      quantity: true,
      purchaseDate: true,
    },
  });

  // Group by normalizedName, track best (lowest) per-unit price per store, plus 90-day frequency
  type Bucket = {
    displayName: string;
    walmart: number | null;
    sams: number | null;
    recentBuys: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const e of entries) {
    const storeKey = bucketStore(e.store);
    if (!storeKey) continue;
    const ppu = e.pricePerUnit ?? (e.quantity ? e.price / e.quantity : e.price);
    const k = e.normalizedName || e.itemName.toLowerCase();
    const b = buckets.get(k) || { displayName: e.itemName, walmart: null, sams: null, recentBuys: 0 };
    if (storeKey === "walmart") {
      b.walmart = b.walmart == null ? ppu : Math.min(b.walmart, ppu);
    } else {
      b.sams = b.sams == null ? ppu : Math.min(b.sams, ppu);
    }
    if (e.purchaseDate >= since) b.recentBuys += 1;
    // Prefer the longest display name as canonical (more descriptive)
    if (e.itemName.length > b.displayName.length) b.displayName = e.itemName;
    buckets.set(k, b);
  }

  const both: CompareRow[] = [];
  const walmartOnly: CompareRow[] = [];
  const samsOnly: CompareRow[] = [];

  for (const [k, b] of buckets) {
    const annualBuys = (b.recentBuys / 90) * 365; // ~per-year frequency from 90-day window
    if (b.walmart != null && b.sams != null) {
      const diff = b.walmart - b.sams; // positive → Sam's wins
      const winner: CompareRow["winner"] =
        Math.abs(diff) < 0.01 ? "tie" : diff > 0 ? "samsclub" : "walmart";
      both.push({
        normalizedName: k,
        displayName: b.displayName,
        walmartPrice: b.walmart,
        samsPrice: b.sams,
        recentBuys: b.recentBuys,
        winner,
        savingsPerUnit: Math.abs(diff),
        estimatedAnnualSavings: Math.round(Math.abs(diff) * Math.max(annualBuys, 1) * 100) / 100,
      });
    } else if (b.walmart != null) {
      walmartOnly.push({
        normalizedName: k,
        displayName: b.displayName,
        walmartPrice: b.walmart,
        samsPrice: null,
        recentBuys: b.recentBuys,
        winner: null,
        savingsPerUnit: null,
        estimatedAnnualSavings: 0,
      });
    } else if (b.sams != null) {
      samsOnly.push({
        normalizedName: k,
        displayName: b.displayName,
        walmartPrice: null,
        samsPrice: b.sams,
        recentBuys: b.recentBuys,
        winner: null,
        savingsPerUnit: null,
        estimatedAnnualSavings: 0,
      });
    }
  }

  both.sort((a, b) => b.estimatedAnnualSavings - a.estimatedAnnualSavings);
  walmartOnly.sort((a, b) => b.recentBuys - a.recentBuys);
  samsOnly.sort((a, b) => b.recentBuys - a.recentBuys);

  const totalAnnualSavings = both
    .filter((r) => r.winner === "samsclub")
    .reduce((sum, r) => sum + r.estimatedAnnualSavings, 0);
  const samsWins = both.filter((r) => r.winner === "samsclub").length;
  const walmartWins = both.filter((r) => r.winner === "walmart").length;

  return NextResponse.json({
    both,
    walmartOnly: walmartOnly.slice(0, 50),
    samsOnly: samsOnly.slice(0, 50),
    summary: {
      itemsCompared: both.length,
      samsWins,
      walmartWins,
      totalAnnualSavings: Math.round(totalAnnualSavings * 100) / 100,
    },
  });
}
