import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSubsite } from "@/lib/subsites";
import { validateActionFields } from "@/lib/agent-manifest";
import { notifyLeadAction } from "@/lib/lead-notify";
import { rateLimitByIp } from "@/lib/rate-limit";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lead/action
 *
 * Transactional submission. Body:
 *   {
 *     subsite: string,
 *     action: string,                           // verb declared in manifest
 *     contact: { email?, name?, phone? },       // at least one required
 *     fields: Record<string, unknown>           // structured per manifest
 *   }
 *
 * Returns:
 *   { receiptToken, statusUrl, status: "new" }
 *
 * Public, unauthenticated. Validates fields against the manifest's action spec.
 */
export async function POST(req: Request) {
  // Public + fires Discord webhook + SMTP email per hit — throttle hard.
  const limited = await rateLimitByIp(req, "lead:action", 5, 600);
  if (limited) return limited;

  let body: {
    subsite?: string;
    action?: string;
    contact?: { email?: string; name?: string; phone?: string };
    fields?: Record<string, unknown>;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subsite = (body.subsite || "").trim();
  const action = (body.action || "").trim();
  const contact = body.contact ?? {};
  const fields = body.fields ?? {};

  const m = getSubsite(subsite);
  if (!m) return NextResponse.json({ error: "Unknown subsite" }, { status: 404 });

  const verb = m.actions.find((a) => a.verb === action);
  if (!verb) {
    return NextResponse.json(
      {
        error: `Subsite '${subsite}' has no action '${action}'`,
        availableActions: m.actions.map((a) => a.verb),
      },
      { status: 400 },
    );
  }

  if (!contact.email && !contact.phone) {
    return NextResponse.json(
      { error: "contact.email or contact.phone required" },
      { status: 400 },
    );
  }
  if (contact.email && !contact.email.includes("@")) {
    return NextResponse.json({ error: "Invalid contact.email" }, { status: 400 });
  }

  const fieldError = validateActionFields(verb, fields);
  if (fieldError) {
    return NextResponse.json(
      { error: fieldError, expected: verb.fields },
      { status: 400 },
    );
  }

  const receiptToken = crypto.randomBytes(8).toString("base64url");

  const row = await prisma.leadAction.create({
    data: {
      receiptToken,
      subsite,
      action,
      email: contact.email ?? null,
      name: contact.name ?? null,
      phone: contact.phone ?? null,
      structured: (fields as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });

  notifyLeadAction({
    subsite,
    action,
    email: contact.email,
    name: contact.name,
    phone: contact.phone,
    fields,
    receiptToken,
  });

  return NextResponse.json({
    receiptToken: row.receiptToken,
    status: row.status,
    statusUrl: `https://www.tolley.io/api/lead/${row.receiptToken}`,
    createdAt: row.createdAt.toISOString(),
    next: "Poll the statusUrl for updates. Status progresses: new → acknowledged → contacted → quoted → won|lost.",
  });
}
