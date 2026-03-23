import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET() {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const configs = await prisma.poolConfig.findMany();
  const map: Record<string, string> = {};
  for (const c of configs) map[c.key] = c.value;

  return NextResponse.json(map);
}

export async function PATCH(req: NextRequest) {
  const ok = await validateShopAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, string> = body;

  for (const [key, value] of Object.entries(updates)) {
    await prisma.poolConfig.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  return NextResponse.json({ ok: true });
}
