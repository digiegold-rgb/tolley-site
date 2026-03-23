import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { calculateLSI } from "@/lib/water-chemistry";

export async function GET(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const limit = Number(url.searchParams.get("limit")) || 50;
  const offset = Number(url.searchParams.get("offset")) || 0;
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.readingAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [readings, total] = await Promise.all([
    prisma.waterReading.findMany({
      where,
      orderBy: { readingAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.waterReading.count({ where }),
  ]);

  return NextResponse.json({ readings, total });
}

export async function POST(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    ph, freeChlorine, totalChlorine, alkalinity, cya,
    calciumHardness, salt, temperature, tds, phosphates,
    notes, source, readingAt,
  } = body;

  // Auto-calculate LSI if we have enough data
  let lsi: number | null = null;
  if (ph != null && temperature != null && calciumHardness != null && alkalinity != null) {
    lsi = calculateLSI({ ph, temperature, calciumHardness, alkalinity, tds: tds ?? 1000 });
  }

  const reading = await prisma.waterReading.create({
    data: {
      ph: ph != null ? Number(ph) : null,
      freeChlorine: freeChlorine != null ? Number(freeChlorine) : null,
      totalChlorine: totalChlorine != null ? Number(totalChlorine) : null,
      alkalinity: alkalinity != null ? Number(alkalinity) : null,
      cya: cya != null ? Number(cya) : null,
      calciumHardness: calciumHardness != null ? Number(calciumHardness) : null,
      salt: salt != null ? Number(salt) : null,
      temperature: temperature != null ? Number(temperature) : null,
      tds: tds != null ? Number(tds) : null,
      lsi,
      phosphates: phosphates != null ? Number(phosphates) : null,
      notes: notes || null,
      source: source || "manual",
      readingAt: readingAt ? new Date(readingAt) : new Date(),
    },
  });

  return NextResponse.json(reading, { status: 201 });
}
