import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { cleanChecklist, cleanDate, cleanStr } from "@/lib/estate-admin";

export const runtime = "nodejs";

/**
 * PATCH /api/hq/estate/sales/[id] — edit a sale with the two playbook
 * guardrails baked in:
 *
 * 1. Setting `address` arms the hourly VIP blast the moment vipNotifyAt
 *    passes (that's the blessed auto-send). The response carries a `warning`
 *    so the UI can spell that out.
 * 2. Flipping status → "done" requires grossTotal + `confirmDone: true`, and
 *    auto-nulls address/addressPublishAt — done sales must never render an
 *    address (privacy gate, ESTATE-PLAYBOOK).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const sale = await prisma.estateSale.findUnique({ where: { id } });
  if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  let warning: string | null = null;

  for (const key of ["title", "areaLabel", "description", "videoUrl"] as const) {
    if (key in body) data[key] = cleanStr(body[key]);
  }
  if ("highlights" in body && Array.isArray(body.highlights)) {
    data.highlights = body.highlights.filter((h) => typeof h === "string" && h.trim());
  }
  if ("days" in body && Array.isArray(body.days)) data.days = body.days;
  for (const key of ["startsAt", "endsAt", "addressPublishAt", "vipNotifyAt"] as const) {
    if (key in body) data[key] = cleanDate(body[key]);
  }
  if ("checklist" in body) {
    const cl = cleanChecklist(body.checklist);
    if (cl) {
      // merge — checkbox PATCHes send only the toggled key
      data.checklist = { ...((sale.checklist as Record<string, boolean>) ?? {}), ...cl };
    }
  }
  if ("grossTotal" in body) {
    const g = typeof body.grossTotal === "number" && Number.isFinite(body.grossTotal)
      ? body.grossTotal
      : null;
    data.grossTotal = g;
  }

  if ("address" in body) {
    const address = cleanStr(body.address);
    data.address = address;
    if (address) {
      const when = sale.vipNotifyAt
        ? new Date(sale.vipNotifyAt).toLocaleString("en-US")
        : "vipNotifyAt (not set yet)";
      warning = `Address saved — the VIP email blast arms and fires on the hourly cron once ${when} passes. Setting the address IS the approval.`;
    }
  }

  if ("status" in body) {
    const status = cleanStr(body.status);
    if (status && !["upcoming", "live", "done"].includes(status)) {
      return NextResponse.json({ error: "status must be upcoming|live|done" }, { status: 400 });
    }
    if (status === "done") {
      const gross =
        (typeof data.grossTotal === "number" ? data.grossTotal : null) ?? sale.grossTotal;
      if (gross == null) {
        return NextResponse.json(
          { error: "Marking done requires grossTotal (the exact gross figure)" },
          { status: 400 },
        );
      }
      if (body.confirmDone !== true) {
        return NextResponse.json(
          {
            error:
              "confirmDone required — marking done permanently scrubs the address from the row (done sales never show an address)",
            needsConfirm: true,
          },
          { status: 409 },
        );
      }
      // Privacy gate: done sales never carry an address.
      data.address = null;
      data.addressPublishAt = null;
      warning = "Sale marked done — address scrubbed from the row (privacy gate).";
    }
    if (status) data.status = status;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No recognized fields" }, { status: 400 });
  }

  try {
    const updated = await prisma.estateSale.update({ where: { id }, data });
    return NextResponse.json({ ok: true, sale: updated, ...(warning ? { warning } : {}) });
  } catch (err) {
    console.error("[hq/estate/sales PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
