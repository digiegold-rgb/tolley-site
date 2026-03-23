import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLSI } from "@/lib/water-chemistry";

/**
 * Device integration endpoint for WaterGuru proxy and Pentair controller.
 *
 * WaterGuru setup:
 *   1. Clone bdwilson/waterguru-api on DGX
 *   2. Configure AWS Cognito credentials
 *   3. Set up cron to POST readings here every 12 hours
 *
 * Pentair setup:
 *   1. Install nodejs-poolController with USB RS-485 adapter
 *   2. Configure webhook to POST equipment data here
 *
 * Auth: Bearer token via WATER_DEVICE_KEY env var
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expectedKey = process.env.WATER_DEVICE_KEY;

  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    source, ph, freeChlorine, totalChlorine, alkalinity, cya,
    calciumHardness, salt, temperature, tds, phosphates,
    notes, readingAt,
  } = body;

  if (!source || !["waterguru", "pentair"].includes(source)) {
    return NextResponse.json({ error: "source must be waterguru or pentair" }, { status: 400 });
  }

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
      source,
      readingAt: readingAt ? new Date(readingAt) : new Date(),
    },
  });

  return NextResponse.json({ ok: true, id: reading.id }, { status: 201 });
}
