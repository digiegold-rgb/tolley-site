// @ts-nocheck — references removed Prisma models
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PayClient from "./pay-client";

export const metadata: Metadata = {
  title: "Pay Invoice | Your KC Homes",
};

export default async function PayPage({
  params,
}: {
  params: Promise<{ invoiceNumber: string }>;
}) {
  const { invoiceNumber } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: {
      contact: { select: { name: true, email: true } },
      lineItems: { select: { description: true, quantity: true, unitAmount: true, lineAmount: true } },
      payments: { select: { amount: true, paidAt: true, method: true } },
    },
  });

  if (!invoice || invoice.status === "VOID") return notFound();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06050a] px-4 py-12">
      <PayClient
        invoice={{
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          issueDate: invoice.issueDate.toISOString(),
          dueDate: invoice.dueDate?.toISOString() || null,
          contactName: invoice.contact?.name || null,
          subTotal: invoice.subTotal,
          total: invoice.total,
          amountDue: invoice.amountDue,
          amountPaid: invoice.amountPaid,
          notes: invoice.notes,
          reference: invoice.reference,
          stripePaymentLinkUrl: invoice.stripePaymentLinkUrl,
          lineItems: invoice.lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitAmount: li.unitAmount,
            lineAmount: li.lineAmount,
          })),
          payments: invoice.payments.map((p) => ({
            amount: p.amount,
            paidAt: p.paidAt.toISOString(),
            method: p.method,
          })),
        }}
      />
    </main>
  );
}
