import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSubsite } from "@/lib/subsites";
import { normalizeAttribution } from "@/lib/discovery-attribution";
import { rateLimitByIp } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const limited = await rateLimitByIp(req, "discovery:inquiry", 5, 3600);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return NextResponse.json({ error: "Invalid inquiry" }, { status: 400 });
  const s = typeof b.offering === "string" ? getSubsite(b.offering) : null;
  if (s?.discovery?.disposition !== "offering" || !s.discovery.operator) return NextResponse.json({ error: "Use the contact details on this service page." }, { status: 400 });
  const text = (v: unknown, n: number) => typeof v === "string" ? v.trim().slice(0, n) : "";
  const name = text(b.name, 120), contact = text(b.contact, 200);
  if (!name || !contact) return NextResponse.json({ error: "Enter your name and phone or email." }, { status: 400 });
  const lead = await prisma.growthLead.create({ data: { name, offer: s.name, source: "discovery-inquiry", stage: "replied", ...(contact.includes("@") ? { email: contact } : { phone: contact }), address: text(b.address, 200) || null, ...(text(b.email, 200).includes("@") ? { email: text(b.email, 200) } : {}), notes: text(b.details, 2000) || null, attribution: normalizeAttribution(b.attribution) } });
  return NextResponse.json({ ok: true, leadId: lead.id });
}
