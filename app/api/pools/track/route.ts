import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Lightweight event tracker for pool product interactions (public, no auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sku, event, meta } = body;

    if (!sku || !event) {
      return NextResponse.json({ error: "Missing sku or event" }, { status: 400 });
    }

    const validEvents = ["view", "cart_add", "filter_click", "mfg_link", "spec_expand"];
    if (!validEvents.includes(event)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    await prisma.poolProductEvent.create({
      data: {
        sku,
        event,
        meta: meta || undefined,
        ip,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
