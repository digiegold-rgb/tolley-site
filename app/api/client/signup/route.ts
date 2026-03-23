// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = body.type as string;
  if (type !== "email" && type !== "sms") {
    return NextResponse.json(
      { error: "type must be 'email' or 'sms'" },
      { status: 400 },
    );
  }

  const email = type === "email" ? (body.email as string)?.trim() : null;
  const phone = type === "sms" ? (body.phone as string)?.trim() : null;

  if (type === "email" && (!email || !email.includes("@"))) {
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  }
  if (type === "sms" && (!phone || phone.replace(/\D/g, "").length < 10)) {
    return NextResponse.json(
      { error: "Valid phone number required" },
      { status: 400 },
    );
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || null;
  const referrer = request.headers.get("referer") || null;

  try {
    const record = await prisma.clientPortalSignup.create({
      data: {
        type,
        email,
        phone: phone ? phone.replace(/\D/g, "") : null,
        role: (body.role as string) || null,
        city: (body.city as string) || null,
        zip: (body.zip as string) || null,
        ip,
        referrer,
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (e) {
    console.error("[client/signup] Error:", e);
    return NextResponse.json(
      { error: "Failed to save. Please try again." },
      { status: 500 },
    );
  }
}
