import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Prisma, type LaundryOperator } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeAttribution } from "@/lib/discovery-attribution";
import { ANCHOR, BASE, CONSENT_VERSION, type Prices } from "./config";
import { covers, searchPlaces, zipPlace } from "./geo";
import { rentalAgreement } from "./legal";
import {
  dateSchema,
  leadSchema,
  operatorSchema,
  requireThat,
} from "./validation";
import type { Actor } from "./auth";
export const digest = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export function receiptToken(id: string) {
  const key = process.env.AUTH_SECRET;
  requireThat(key, "Request links are not configured.", 503);
  return createHmac("sha256", key)
    .update(`laundry-receipt:${id}`)
    .digest("hex");
}
export function verifyReceipt(id: string, token: string) {
  const expected = receiptToken(id);
  return (
    /^[a-f0-9]{64}$/.test(token) &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(token))
  );
}
export function receiptUrl(id: string) {
  return `${BASE}/laundry/request/${id}?token=${receiptToken(id)}`;
}
export async function seedAnchor() {
  return prisma.laundryOperator.upsert({
    where: { id: ANCHOR.id },
    create: { ...ANCHOR, approvedAt: new Date() },
    update: {},
  });
}
export async function publicOperators(query = "") {
  const rows = await prisma.laundryOperator.findMany({
    where: { status: "approved" },
    orderBy: [{ anchor: "desc" }, { lastAssignedAt: "asc" }, { name: "asc" }],
  });
  const places = searchPlaces(query);
  return rows
    .filter((op) => !query || places.some((p) => covers(op, p.zip)))
    .map(publicOperator);
}
export function publicOperator(op: LaundryOperator) {
  return {
    id: op.id,
    slug: op.slug,
    name: op.name,
    legalName: op.legalName,
    phone: op.phone,
    city: op.city,
    state: op.state,
    zip: op.zip,
    zips: op.zips,
    radiusMiles: op.radiusMiles,
    description: op.description,
    prices: op.prices as Prices,
    deliveryFeeCents: op.deliveryFeeCents,
    rentalTerms: op.rentalTerms,
    termsVersion: op.termsVersion,
    anchor: op.anchor,
  };
}
export async function agreementFor(operatorId: string, unit: string) {
  const op = await prisma.laundryOperator.findFirst({
    where: { id: operatorId, status: "approved" },
  });
  requireThat(op, "This operator is unavailable.", 404);
  const text = rentalAgreement(op, unit);
  return { text, hash: digest(text) };
}
export async function queue(
  tx: Prisma.TransactionClient,
  id: string,
  channel: string,
  recipient: string,
  body: string,
) {
  await tx.laundryNotification.upsert({
    where: { id },
    create: { id, channel, recipient, body },
    update: {},
  });
}
export async function notifyRenter(
  tx: Prisma.TransactionClient,
  lead: { id: string; email: string; phone: string; smsConsent: boolean },
  event: string,
  text: string,
) {
  const body = `Laundry Rental Network: ${text}\nManage your request and download your agreement: ${receiptUrl(lead.id)}`;
  await queue(tx, `${lead.id}:${event}:email`, "email", lead.email, body);
  if (lead.smsConsent)
    await queue(
      tx,
      `${lead.id}:${event}:sms`,
      "sms",
      lead.phone,
      body + "\nReply STOP to opt out; HELP for help.",
    );
}
export async function createLead(input: unknown) {
  const b = leadSchema.parse(input),
    normalized = normalizeAttribution(b.attribution);
  const payloadHash = digest(
    JSON.stringify({ ...b, attribution: normalized || {} }),
  );
  // Concurrent retries serialize on the request key and return the original receipt only for identical content.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${b.requestKey}))`;
    const existing = await tx.laundryLead.findUnique({
      where: { requestKey: b.requestKey },
    });
    if (existing) {
      requireThat(
        existing.payloadHash === payloadHash,
        "This request key was already used. Refresh and try again.",
        409,
      );
      return { id: existing.id, url: receiptUrl(existing.id) };
    }
    const op = b.operatorId
      ? await tx.laundryOperator.findFirst({
          where: { id: b.operatorId, status: "approved" },
        })
      : null;
    if (b.operatorId)
      requireThat(op, "This operator is no longer accepting requests.", 409);
    let text: string | null = null;
    if (op) {
      requireThat(covers(op, b.zip), "This operator does not serve that ZIP.");
      text = rentalAgreement(op, b.unit);
      requireThat(
        b.agreementHash === digest(text),
        "The rental terms changed. Review and sign the current agreement.",
        409,
      );
      requireThat(
        b.signedName.length >= 2 &&
          b.signedName.toLowerCase() === b.name.toLowerCase(),
        "Sign using your full name as entered above.",
      );
    }
    const contactKey = digest(
      `${b.operatorId}:${b.phone}:${b.address.toLowerCase().trim()}:${b.unit}`,
    );
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contactKey}))`;
    const duplicate = await tx.laundryLead.findFirst({
      where: {
        operatorId: op?.id || null,
        phone: b.phone,
        address: { equals: b.address, mode: "insensitive" },
        unit: b.unit,
        status: { in: ["requested", "accepted", "booked", "waitlisted"] },
      },
    });
    requireThat(
      !duplicate,
      "An active request already exists for these details. Use your private request link or contact support.",
      409,
    );
    const place = zipPlace(b.zip)!;
    const lead = await tx.laundryLead.create({
      data: {
        requestKey: b.requestKey,
        payloadHash,
        operatorId: op?.id,
        status: op ? "requested" : "waitlisted",
        name: b.name,
        phone: b.phone,
        email: b.email,
        address: b.address,
        city: place.city,
        state: place.state,
        zip: b.zip,
        unit: b.unit,
        preferredDate: b.preferredDate,
        notes: b.notes,
        smsConsent: b.smsConsent,
        attribution: JSON.parse(JSON.stringify(normalized || {})),
        agreementText: text,
        agreementHash: text ? digest(text) : null,
        signedName: op ? b.signedName : null,
        signedAt: op ? new Date() : null,
        consentVersion: CONSENT_VERSION,
        expiresAt: op ? new Date(Date.now() + 86400000) : null,
      },
    });
    await tx.laundryEvent.create({
      data: {
        leadId: lead.id,
        actor: "renter",
        action: "created",
        detail: op
          ? "Signed request assigned to selected operator."
          : "Uncovered-area interest saved; no operator received personal details.",
      },
    });
    await notifyRenter(
      tx,
      lead,
      "created",
      op
        ? `Your request for ${b.preferredDate} was saved and sent to ${op.name}. Your delivery is not yet confirmed.`
        : "Your interest was saved. No operator is currently assigned; this is not a reservation.",
    );
    if (op) {
      await tx.laundryOperator.update({
        where: { id: op.id },
        data: { lastAssignedAt: new Date() },
      });
      await queue(
        tx,
        `${lead.id}:operator`,
        "email",
        op.email,
        `A signed rental request is waiting. Accept or decline within 24 hours: ${BASE}/laundry/dashboard`,
      );
    }
    return { id: lead.id, url: receiptUrl(lead.id) };
  });
}
export async function joinOperator(who: Actor, input: unknown) {
  const b = operatorSchema.parse(input),
    place = zipPlace(b.zip)!;
  const old = await prisma.laundryOperator.findUnique({
    where: { ownerId: who.id },
  });
  requireThat(
    !old,
    "You already have a listing. Edit it in your dashboard.",
    409,
  );
  const slug =
    b.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 65) +
    "-" +
    digest(who.id).slice(0, 8);
  const { termsAccepted: _, ...data } = b;
  return prisma.laundryOperator.create({
    data: {
      ...data,
      ownerId: who.id,
      email: who.email,
      slug,
      city: place.city,
      state: place.state,
      agreementVersion: CONSENT_VERSION,
    },
  });
}
export async function ownOperator(who: Actor, id?: string) {
  const op = await prisma.laundryOperator.findFirst({
    where: id
      ? { id, ...(who.admin ? {} : { ownerId: who.id }) }
      : { ownerId: who.id },
  });
  requireThat(op, "Operator not found.", 404);
  return op;
}
export async function editOperator(who: Actor, id: string, input: unknown) {
  const op = await ownOperator(who, id),
    b = operatorSchema.parse(input),
    place = zipPlace(b.zip)!;
  const { termsAccepted: _, ...data } = b;
  return prisma.laundryOperator.update({
    where: { id: op.id },
    data: {
      ...data,
      city: place.city,
      state: place.state,
      status: "pending",
      approvedAt: null,
      termsVersion: { increment: 1 },
      agreementVersion: CONSENT_VERSION,
      agreementAcceptedAt: new Date(),
    },
  });
}
export async function leadAction(
  who: Actor,
  id: string,
  action: string,
  value?: string,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const lead = await tx.laundryLead.findUnique({
      where: { id },
      include: { operator: true, booking: true },
    });
    requireThat(
      lead && (who.admin || lead.operator?.ownerId === who.id),
      "Request not found.",
      404,
    );
    const event = async (detail: string) =>
      tx.laundryEvent.create({
        data: { leadId: id, actor: who.id, action, detail },
      });
    if (action === "accept") {
      requireThat(
        lead.status === "requested" &&
          lead.operator?.status === "approved" &&
          lead.signedAt &&
          lead.expiresAt &&
          lead.expiresAt > new Date(),
        "This request is no longer available.",
        409,
      );
      await tx.laundryLead.update({
        where: { id },
        data: { status: "accepted", expiresAt: null },
      });
      await event("Accepted without charge.");
    } else if (action === "decline") {
      requireThat(
        ["requested", "accepted"].includes(lead.status),
        "Only unbooked requests can be declined.",
        409,
      );
      await tx.laundryLead.update({
        where: { id },
        data: { status: "declined", expiresAt: null },
      });
      await event(
        "Declined; renter may select and sign with another operator.",
      );
      await notifyRenter(
        tx,
        lead,
        "declined",
        "Your operator could not take this request. You can choose another operator through your request link.",
      );
    } else if (action === "confirm") {
      const day = dateSchema.parse(value);
      if (lead.booking) {
        requireThat(
          lead.deliveryDate === day && lead.status === "booked",
          "Use reschedule for an existing booking.",
          409,
        );
        return lead.booking;
      }
      requireThat(
        lead.status === "accepted" &&
          lead.operator?.status === "approved" &&
          lead.signedAt,
        "Accept a signed request before confirming delivery.",
        409,
      );
      const op = lead.operator;
      requireThat(
        op.feeCents === 0 ||
          (process.env.LAUNDRY_BILLING_ENABLED === "true" &&
            op.paymentMethodId &&
            op.stripeCustomerId),
        "Set up billing before confirming a paid booking.",
        409,
      );
      const booking = await tx.laundryBooking.create({
        data: {
          leadId: id,
          feeCents: op.feeCents,
          status: op.feeCents === 0 ? "waived" : "pending",
        },
      });
      await tx.laundryLead.update({
        where: { id },
        data: { status: "booked", deliveryDate: day },
      });
      await event(
        `Delivery confirmed for ${day}; booking fee ${op.feeCents} cents.`,
      );
      await notifyRenter(
        tx,
        lead,
        "booked",
        `${op.name} confirmed your delivery for ${day}.`,
      );
      return booking;
    } else if (action === "reschedule") {
      const day = dateSchema.parse(value);
      requireThat(
        lead.status === "booked",
        "Only booked deliveries can be rescheduled.",
        409,
      );
      await tx.laundryLead.update({
        where: { id },
        data: { deliveryDate: day },
      });
      await event(`Rescheduled to ${day}; no additional fee.`);
      await notifyRenter(
        tx,
        lead,
        `reschedule:${day}`,
        `Your operator rescheduled delivery to ${day}.`,
      );
    } else if (action === "delivered") {
      requireThat(
        lead.status === "booked",
        "Only booked requests can be marked delivered.",
        409,
      );
      await tx.laundryLead.update({
        where: { id },
        data: { status: "delivered" },
      });
      await event("Operator recorded completed delivery.");
      await notifyRenter(
        tx,
        lead,
        "delivered",
        "Your operator recorded your delivery. You can now leave a verified-booking review.",
      );
    } else if (action === "cancel" || action === "no_show") {
      requireThat(
        ["requested", "accepted", "booked"].includes(lead.status),
        "This request cannot be cancelled in its current state.",
        409,
      );
      await tx.laundryLead.update({
        where: { id },
        data: { status: "cancelled", expiresAt: null },
      });
      if (lead.booking && lead.booking.feeCents > 0)
        await tx.laundryBooking.update({
          where: { id: lead.booking.id },
          data: {
            disputeStatus: "approved",
            disputeReason: action,
            status: "refund_pending",
          },
        });
      await event(action);
      await notifyRenter(
        tx,
        lead,
        "cancelled",
        "Your delivery request was cancelled.",
      );
      if (lead.operator)
        await queue(
          tx,
          `${id}:operator-cancelled`,
          "email",
          lead.operator.email,
          `A delivery request was cancelled. Check your workspace before dispatching: ${BASE}/laundry/dashboard`,
        );
    } else if (action === "dispute") {
      requireThat(
        lead.booking &&
          value &&
          value.trim().length >= 10 &&
          value.length <= 2000,
        "Explain the dispute in at least 10 characters.",
      );
      requireThat(
        !lead.booking.refundedAt && lead.booking.disputeStatus !== "approved",
        "This booking is already being refunded.",
        409,
      );
      await tx.laundryBooking.update({
        where: { id: lead.booking.id },
        data: { disputeReason: value, disputeStatus: "open" },
      });
      await event("Booking fee disputed.");
    } else throw new Error("Unknown request action.");
    return { ok: true };
  });
}
export async function renterAction(
  id: string,
  token: string,
  action: string,
  input: Record<string, unknown>,
) {
  requireThat(verifyReceipt(id, token), "Invalid private request link.", 404);
  if (action === "cancel")
    return leadAction({ id: "renter", email: "", admin: true }, id, "cancel");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
    const lead = await tx.laundryLead.findUnique({ where: { id } });
    requireThat(lead, "Request not found.", 404);
    if (action === "review") {
      requireThat(
        lead.status === "delivered",
        "Reviews are available after delivery.",
        409,
      );
      const rating = Number(input.rating),
        body = String(input.body || "").trim();
      requireThat(
        Number.isInteger(rating) &&
          rating >= 1 &&
          rating <= 5 &&
          body.length >= 10 &&
          body.length <= 2000,
        "Add a rating and a review of 10–2,000 characters.",
      );
      const parts = lead.name.split(/\s+/);
      const displayName =
        parts[0] + (parts.length > 1 ? ` ${parts.at(-1)![0]}.` : "");
      return tx.laundryReview.upsert({
        where: { leadId: id },
        create: { leadId: id, rating, body, displayName },
        update: {},
      });
    }
    requireThat(
      action === "reassign" &&
        ["declined", "waitlisted", "expired"].includes(lead.status),
      "This request cannot be reassigned.",
      409,
    );
    const op = await tx.laundryOperator.findFirst({
      where: { id: String(input.operatorId), status: "approved" },
    });
    requireThat(
      op && covers(op, lead.zip),
      "Choose an operator serving your ZIP.",
    );
    const text = rentalAgreement(op, lead.unit);
    requireThat(
      input.agreementHash === digest(text) &&
        String(input.signedName).trim().toLowerCase() ===
          lead.name.toLowerCase() &&
        input.termsAccepted === true,
      "Review and sign the selected operator’s current terms.",
    );
    await tx.laundryLead.update({
      where: { id },
      data: {
        operatorId: op.id,
        status: "requested",
        agreementText: text,
        agreementHash: digest(text),
        signedName: lead.name,
        signedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    await tx.laundryEvent.create({
      data: {
        leadId: id,
        actor: "renter",
        action: "reassigned",
        detail: JSON.stringify({
          message: `Renter signed with ${op.name}. Previous agreement superseded; no booking fee charged.`,
          previousAgreement: lead.agreementText,
          previousSignature: lead.signedName,
          previousSignedAt: lead.signedAt,
        }),
      },
    });
    await queue(
      tx,
      `${id}:operator:${op.id}`,
      "email",
      op.email,
      `A signed rental request is waiting: ${BASE}/laundry/dashboard`,
    );
    await notifyRenter(
      tx,
      lead,
      `reassigned:${op.id}`,
      `Your signed request was sent to ${op.name}.`,
    );
    return { ok: true };
  });
}
