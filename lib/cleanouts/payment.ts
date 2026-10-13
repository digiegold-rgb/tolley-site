import { createInvoicePaymentLink } from "@/lib/account/stripe-payment-link";
import {
  CASH_NOTE_MARKER,
  normalizeInvoiceNumber,
  withCleanoutPaymentNotes,
} from "@/lib/legal-cleanouts";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, type RateLimitResult } from "@/lib/rate-limit";

export const CLEANOUT_PAYMENT_LIMIT = 12;
export const CLEANOUT_PAYMENT_WINDOW_SECONDS = 15 * 60;

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  status: true,
  issueDate: true,
  dueDate: true,
  subTotal: true,
  total: true,
  amountDue: true,
  amountPaid: true,
  reference: true,
  notes: true,
  stripePaymentLinkId: true,
  stripePaymentLinkUrl: true,
  contact: { select: { name: true, email: true } },
  lineItems: {
    orderBy: { sortOrder: "asc" as const },
    select: { description: true, quantity: true, lineAmount: true, sortOrder: true },
  },
};

type LoadedInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: Date;
  dueDate: Date | null;
  subTotal: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  reference: string | null;
  notes: string | null;
  stripePaymentLinkId: string | null;
  stripePaymentLinkUrl: string | null;
  contact: { name: string; email: string | null } | null;
  lineItems: { description: string; quantity: number; lineAmount: number; sortOrder: number }[];
};

export type PublicCleanoutInvoice = {
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  contactName: string | null;
  subTotal: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  reference: string | null;
  notes: string | null;
  lineItems: { description: string; quantity: number; lineAmount: number }[];
  paid: boolean;
  cashNoted: boolean;
};

export function requestIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return (
    (forwarded ? forwarded.split(",")[0].trim() : "") ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export function limitCleanoutPayment(ip: string): Promise<RateLimitResult> {
  return consumeRateLimit(
    `cleanout-payment:${ip}`,
    CLEANOUT_PAYMENT_LIMIT,
    CLEANOUT_PAYMENT_WINDOW_SECONDS,
  );
}

export function toPublicInvoice(invoice: LoadedInvoice): PublicCleanoutInvoice {
  const paid = invoice.status === "PAID" || invoice.amountDue <= 0;
  return {
    invoiceNumber: invoice.invoiceNumber,
    status: paid ? "PAID" : invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    contactName: invoice.contact?.name ?? null,
    subTotal: invoice.subTotal,
    total: invoice.total,
    amountDue: invoice.amountDue,
    amountPaid: invoice.amountPaid,
    reference: invoice.reference,
    notes: invoice.notes,
    lineItems: invoice.lineItems.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      lineAmount: line.lineAmount,
    })),
    paid,
    cashNoted: Boolean(invoice.notes?.includes(CASH_NOTE_MARKER)),
  };
}

async function loadInvoice(invoiceNumber: string): Promise<LoadedInvoice | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    select: invoiceSelect,
  });
  if (!invoice || invoice.status === "VOID") return null;
  return invoice;
}

export async function lookupCleanoutInvoice(
  rawNumber: string,
): Promise<
  | { ok: true; invoice: PublicCleanoutInvoice }
  | { ok: false; error: "invalid" | "missing" }
> {
  const invoiceNumber = normalizeInvoiceNumber(rawNumber);
  if (!invoiceNumber) return { ok: false, error: "invalid" };
  const invoice = await loadInvoice(invoiceNumber);
  if (!invoice) return { ok: false, error: "missing" };
  return { ok: true, invoice: toPublicInvoice(invoice) };
}

export type PaymentActionResult =
  | { ok: true; kind: "card"; payPath: string }
  | { ok: true; kind: "cash"; invoiceNumber: string }
  | { ok: false; code: "missing" | "paid"; message: string };

/**
 * Record terms acceptance, and for cash/check only append a note.
 * Card/bank reuses the invoice's Stripe link or mints one, then sends the
 * customer to /pay/INV-#### (card link + bank ACH). Amounts are never written.
 */
export async function applyCleanoutPaymentChoice(
  rawNumber: string,
  choice: "card" | "cash",
  at = new Date(),
): Promise<PaymentActionResult> {
  const invoiceNumber = normalizeInvoiceNumber(rawNumber);
  if (!invoiceNumber) return { ok: false, code: "missing", message: "missing" };
  const invoice = await loadInvoice(invoiceNumber);
  if (!invoice) return { ok: false, code: "missing", message: "missing" };
  if (invoice.status === "PAID" || invoice.amountDue <= 0) {
    return { ok: false, code: "paid", message: "paid" };
  }

  const notes = withCleanoutPaymentNotes(invoice.notes, choice, at);
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { notes },
  });

  if (choice === "cash") {
    return { ok: true, kind: "cash", invoiceNumber: invoice.invoiceNumber };
  }

  if (!invoice.stripePaymentLinkUrl && invoice.amountDue > 0) {
    try {
      const link = await createInvoicePaymentLink({
        id: invoice.id,
        total: invoice.amountDue,
        invoiceNumber: invoice.invoiceNumber,
        contact: invoice.contact,
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          stripePaymentLinkId: link.paymentLinkId,
          stripePaymentLinkUrl: link.paymentLinkUrl,
        },
      });
    } catch (err) {
      // Bank transfer on /pay does not need the card link. Keep that path open.
      console.error(
        `[cleanouts/payment] Stripe link failed for ${invoice.invoiceNumber}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  const payPath = `/pay/${invoice.invoiceNumber}`;
  if (!/^\/pay\/INV-\d{1,10}$/.test(payPath)) {
    return { ok: false, code: "missing", message: "missing" };
  }
  return { ok: true, kind: "card", payPath };
}
