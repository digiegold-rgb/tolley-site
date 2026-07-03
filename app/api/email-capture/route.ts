import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyLead } from "@/lib/lead-notify";

export const runtime = "nodejs";

/**
 * POST /api/email-capture
 *
 * Captures an email lead from any ungated tool/resource.
 * Body: { email, name?, source, data? }
 */
export async function POST(request: Request) {
  try {
    const { email, name, source, data } = await request.json() as {
      email?: string;
      name?: string;
      source?: string;
      data?: Record<string, unknown>;
    };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    if (!source) {
      return NextResponse.json({ error: "Source required" }, { status: 400 });
    }

    // Detect new vs duplicate so we only notify once per email
    const existing = await prisma.emailLead.findUnique({ where: { email }, select: { id: true } });
    const isNew = !existing;

    const lead = await prisma.emailLead.upsert({
      where: { email },
      create: {
        email,
        name: name ?? null,
        source,
        data: data as Prisma.InputJsonValue ?? Prisma.JsonNull,
        tags: [source],
        optedIn: true,
      },
      update: {
        // Don't overwrite name if already set; update source/data to latest
        ...(name ? { name } : {}),
        source,
        data: data as Prisma.InputJsonValue ?? Prisma.JsonNull,
      },
    });

    notifyLead({ source, email, name, data, isNew });

    return NextResponse.json({ ok: true, id: lead.id, isNew });
  } catch (error) {
    console.error("email-capture error", error);
    return NextResponse.json({ error: "Failed to capture email" }, { status: 500 });
  }
}
