"use client";

import { useState } from "react";
import Script from "next/script";

type LineItem = { description: string; quantity: number; unitAmount: number; lineAmount: number };
type Payment = { amount: number; paidAt: string; method: string | null };

type InvoiceData = {
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  contactName: string | null;
  subTotal: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  notes: string | null;
  reference: string | null;
  stripePaymentLinkUrl: string | null;
  lineItems: LineItem[];
  payments: Payment[];
};

const PAY_API = process.env.NEXT_PUBLIC_PAY_API || "https://pay-api.tolley.io";

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function PayClient({ invoice }: { invoice: InvoiceData }) {
  const [achStatus, setAchStatus] = useState<string>("");
  const [achLoading, setAchLoading] = useState(false);
  const [plaidReady, setPlaidReady] = useState(false);

  const isPaid = invoice.status === "PAID" || invoice.amountDue <= 0;

  async function startACH() {
    setAchLoading(true);
    setAchStatus("Connecting to your bank...");
    try {
      const tokenResp = await fetch(`${PAY_API}/pay/link-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: invoice.invoiceNumber }),
      });
      const tokenData = await tokenResp.json();
      if (tokenData.error) throw new Error(tokenData.error);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Plaid = (window as any).Plaid;
      const handler = Plaid.create({
        token: tokenData.link_token,
        onSuccess: async (publicToken: string, metadata: { accounts: Array<{ id: string }> }) => {
          setAchStatus("Setting up ACH payment...");
          try {
            const setupResp = await fetch(`${PAY_API}/pay/ach-setup`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                public_token: publicToken,
                account_id: metadata.accounts[0]?.id,
              }),
            });
            const setupData = await setupResp.json();
            if (setupData.error) throw new Error(setupData.error);

            // Now charge via Stripe ACH using the processor token
            const chargeResp = await fetch(`/api/pay/${invoice.invoiceNumber}/ach`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                stripeBankToken: setupData.stripeBankToken,
                amount: invoice.amountDue,
              }),
            });
            const chargeData = await chargeResp.json();
            if (chargeData.error) throw new Error(chargeData.error);

            setAchStatus("Payment initiated! ACH transfers typically settle in 1-3 business days.");
          } catch (err) {
            setAchStatus(`Setup failed: ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        },
        onExit: () => {
          setAchLoading(false);
          if (!achStatus.includes("initiated")) setAchStatus("");
        },
      });
      handler.open();
    } catch (err) {
      setAchStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setAchLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
        onLoad={() => setPlaidReady(true)}
      />

      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-[0.7rem] tracking-[0.38em] text-white/50 uppercase">your kc homes llc</p>
          <h1 className="mt-2 text-2xl font-semibold text-white/95">Invoice {invoice.invoiceNumber}</h1>
          {invoice.contactName && (
            <p className="mt-1 text-sm text-white/50">Bill to: {invoice.contactName}</p>
          )}
        </div>

        {/* Invoice details */}
        <div className="rounded-2xl border border-white/14 bg-white/[0.03] p-6 space-y-4">
          {/* Status badge */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/40">Status</span>
            <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
              isPaid ? "bg-green-500/20 text-green-400" :
              invoice.status === "OVERDUE" ? "bg-red-500/20 text-red-400" :
              "bg-amber-500/20 text-amber-400"
            }`}>
              {isPaid ? "PAID" : invoice.status}
            </span>
          </div>

          {/* Dates */}
          <div className="flex justify-between text-sm">
            <span className="text-white/40">Issue Date</span>
            <span className="text-white/80">{new Date(invoice.issueDate).toLocaleDateString()}</span>
          </div>
          {invoice.dueDate && (
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Due Date</span>
              <span className="text-white/80">{new Date(invoice.dueDate).toLocaleDateString()}</span>
            </div>
          )}

          {/* Line items */}
          <div className="border-t border-white/10 pt-3">
            {invoice.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between py-1.5 text-sm">
                <div>
                  <span className="text-white/80">{li.description}</span>
                  {li.quantity !== 1 && (
                    <span className="text-white/40 ml-2">x{li.quantity}</span>
                  )}
                </div>
                <span className="text-white/80">{fmt.format(li.lineAmount)}</span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-white/10 pt-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-white/40">Subtotal</span>
              <span className="text-white/80">{fmt.format(invoice.subTotal)}</span>
            </div>
            {invoice.amountPaid > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-white/40">Paid</span>
                <span className="text-green-400">-{fmt.format(invoice.amountPaid)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
              <span className="text-white/90">Amount Due</span>
              <span className={isPaid ? "text-green-400" : "text-white"}>{fmt.format(invoice.amountDue)}</span>
            </div>
          </div>

          {invoice.notes && (
            <p className="text-xs text-white/40 border-t border-white/10 pt-3">{invoice.notes}</p>
          )}
        </div>

        {/* Payment buttons */}
        {!isPaid && (
          <div className="space-y-3">
            {/* ACH option */}
            <button
              onClick={startACH}
              disabled={achLoading || !plaidReady}
              className="w-full rounded-xl bg-green-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Pay by Bank (ACH) — Save ~2%
            </button>

            {/* Card option */}
            {invoice.stripePaymentLinkUrl && (
              <a
                href={invoice.stripePaymentLinkUrl}
                className="block w-full rounded-xl bg-violet-600 px-4 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-violet-500"
              >
                Pay by Card
              </a>
            )}

            {achStatus && (
              <p className={`text-sm text-center ${achStatus.includes("initiated") ? "text-green-400" : achStatus.includes("Error") || achStatus.includes("failed") ? "text-red-400" : "text-white/50"}`}>
                {achStatus}
              </p>
            )}

            <p className="text-center text-[0.65rem] text-white/30">
              ACH: 0.8% fee (capped at $5) | Card: 2.9% + $0.30
            </p>
          </div>
        )}

        {isPaid && (
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-center">
            <p className="text-green-400 font-semibold">This invoice has been paid</p>
            {invoice.payments.length > 0 && (
              <p className="text-xs text-white/40 mt-1">
                Last payment: {fmt.format(invoice.payments[0].amount)} on {new Date(invoice.payments[0].paidAt).toLocaleDateString()}
                {invoice.payments[0].method && ` via ${invoice.payments[0].method}`}
              </p>
            )}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[0.6rem] text-white/20">
          Your KC Homes LLC | Independence, MO | Powered by Plaid + Stripe
        </p>
      </div>
    </>
  );
}
