import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import {
  limitCleanoutPayment,
  lookupCleanoutInvoice,
  requestIp,
  type PublicCleanoutInvoice,
} from "@/lib/cleanouts/payment";
import {
  CK_ENTITY,
  CK_PAYMENT_PATH,
  CK_PHONE,
  CK_PHONE_SMS,
  CK_PHONE_TEL,
  CK_TERMS_PATH,
  PAYMENT_COPY,
} from "@/lib/legal-cleanouts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: { absolute: `${PAYMENT_COPY.title} | ${CK_ENTITY}` },
  description: PAYMENT_COPY.description,
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.tolley.io/cleanouts/payment" },
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function errorMessage(code: string): string | null {
  if (code === "terms") return PAYMENT_COPY.termsRequired;
  if (code === "rate") return PAYMENT_COPY.rateLimited;
  if (code === "invalid") return PAYMENT_COPY.invalidNumber;
  if (code === "missing") return PAYMENT_COPY.notFound;
  if (code === "amount") return PAYMENT_COPY.amountRejected;
  if (code === "paid") return PAYMENT_COPY.paidTitle;
  if (code === "choice") return PAYMENT_COPY.choiceInvalid;
  if (code === "link") return PAYMENT_COPY.unavailable;
  if (code === "origin") return PAYMENT_COPY.originError;
  return null;
}

function InvoiceDetails({ invoice }: { invoice: PublicCleanoutInvoice }) {
  return (
    <div className="tc-form space-y-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="tc-display text-xl text-white">Invoice {invoice.invoiceNumber}</h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#ff7a1a]">{invoice.status}</span>
      </div>
      {invoice.contactName ? (
        <p className="text-sm text-white/60">Bill to {invoice.contactName}</p>
      ) : null}
      <p className="text-sm text-white/50">
        Issued {new Date(invoice.issueDate).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}
        {invoice.dueDate
          ? ` · Due ${new Date(invoice.dueDate).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}`
          : ""}
      </p>
      <div className="border-t border-white/10 pt-3">
        {invoice.lineItems.map((line, index) => (
          <div key={`${line.description}-${index}`} className="flex items-start justify-between gap-4 py-1.5 text-sm">
            <span className={line.lineAmount < 0 ? "text-amber-300" : "text-white/80"}>
              {line.description}
              {line.quantity !== 1 ? <span className="text-white/40"> × {line.quantity}</span> : null}
            </span>
            <span className={line.lineAmount < 0 ? "text-amber-300" : "text-white"}>
              {money.format(line.lineAmount)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-sm text-white/60">{PAYMENT_COPY.amountDueLabel}</span>
        <span className="text-lg font-semibold text-white">{money.format(invoice.amountDue)}</span>
      </div>
      {invoice.notes ? (
        <p className="whitespace-pre-wrap border-t border-white/10 pt-3 text-xs leading-relaxed text-white/50">
          {invoice.notes}
        </p>
      ) : null}
    </div>
  );
}

export default async function CleanoutPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const invoiceParam = first(params.invoice).trim();
  const company = first(params.company).trim() || first(params.website).trim();
  const choice = first(params.choice);
  const banner = errorMessage(first(params.error));

  let invoice: PublicCleanoutInvoice | null = null;
  let lookupError: string | null = null;

  if (company) {
    lookupError = PAYMENT_COPY.notFound;
  } else if (invoiceParam) {
    try {
      const ip = requestIp(await headers());
      const limited = await limitCleanoutPayment(ip);
      if (!limited.allowed) {
        lookupError = PAYMENT_COPY.rateLimited;
      } else {
        const result = await lookupCleanoutInvoice(invoiceParam);
        if (!result.ok) {
          lookupError = result.error === "invalid" ? PAYMENT_COPY.invalidNumber : PAYMENT_COPY.notFound;
        } else {
          invoice = result.invoice;
        }
      }
    } catch (err) {
      console.error("[cleanouts/payment] lookup failed:", err instanceof Error ? err.message : err);
      lookupError = PAYMENT_COPY.unavailable;
    }
  }

  const showCashThanks = choice === "cash" || Boolean(invoice?.cashNoted);

  return (
    <main className="relative z-10 min-h-screen px-5 pb-20 sm:px-8">
      <div className="mx-auto max-w-xl">
        <nav className="pt-6 text-xs text-white/50">
          <Link href="/cleanouts" className="hover:text-white hover:underline">
            ← Cleanouts
          </Link>
        </nav>

        <header className="mt-10 text-center">
          <div className="mx-auto inline-block rounded bg-white px-4 py-2">
            <img src="/homes/logo.svg" alt="Your KC Homes LLC" width={260} height={61} />
          </div>
          <p className="tc-kicker mt-8">{PAYMENT_COPY.kicker}</p>
          <h1 className="tc-display mt-4 text-3xl text-white sm:text-4xl">{PAYMENT_COPY.title}</h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-white/60">{PAYMENT_COPY.intro}</p>
        </header>

        <form method="get" action={CK_PAYMENT_PATH} className="tc-form mt-8 space-y-4 p-6">
          <div>
            <label htmlFor="cleanout-invoice" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-white/50">
              {PAYMENT_COPY.invoiceLabel}
            </label>
            <input
              id="cleanout-invoice"
              name="invoice"
              defaultValue={invoiceParam}
              placeholder={PAYMENT_COPY.invoicePlaceholder}
              autoComplete="off"
              spellCheck={false}
              className="tc-input px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="tc-btn-secondary w-full rounded px-4 py-3 text-sm">
            {PAYMENT_COPY.lookupButton}
          </button>
        </form>

        {banner ? <p className="mt-4 text-sm text-amber-300">{banner}</p> : null}
        {lookupError ? <p className="mt-4 text-sm text-amber-300">{lookupError}</p> : null}

        {invoice ? (
          <div className="mt-6 space-y-4">
            <InvoiceDetails invoice={invoice} />
            <p className="text-xs leading-relaxed text-white/45">{PAYMENT_COPY.depositNote}</p>
            <p className="text-xs leading-relaxed text-white/45">{PAYMENT_COPY.consignmentNote}</p>

            {invoice.paid ? (
              <div className="tc-diff p-6 text-center">
                <p className="text-white">{PAYMENT_COPY.paidTitle}</p>
              </div>
            ) : (
              <form method="post" action="/api/cleanouts/payment" className="tc-form relative space-y-4 p-6">
                <input type="hidden" name="invoiceNumber" value={invoice.invoiceNumber} />
                <div className="absolute -left-[9999px] h-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="cleanout-website">Website</label>
                  <input id="cleanout-website" name="website" tabIndex={-1} autoComplete="off" />
                </div>
                {showCashThanks ? <p className="text-sm text-white/80">{PAYMENT_COPY.cashThanks}</p> : null}
                <label className="flex items-start gap-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    value="yes"
                    required
                    className="mt-1"
                  />
                  <span>
                    {PAYMENT_COPY.termsBefore}{" "}
                    <Link href={CK_TERMS_PATH} className="text-[#ff7a1a] underline underline-offset-2">
                      {PAYMENT_COPY.termsLink}
                    </Link>{" "}
                    {PAYMENT_COPY.termsAfter}
                  </span>
                </label>
                <button type="submit" name="choice" value="card" className="tc-btn-primary w-full rounded px-4 py-3 text-sm">
                  {PAYMENT_COPY.cardButton}
                </button>
                <p className="text-xs leading-relaxed text-white/45">{PAYMENT_COPY.cashNote}</p>
                <button type="submit" name="choice" value="cash" className="tc-btn-secondary w-full rounded px-4 py-3 text-sm">
                  {PAYMENT_COPY.cashButton}
                </button>
              </form>
            )}
          </div>
        ) : null}

        <p className="mt-8 text-center text-xs text-white/40">
          {PAYMENT_COPY.callPrompt}{" "}
          <a href={CK_PHONE_TEL} className="text-[#ff7a1a] hover:underline">
            {CK_PHONE}
          </a>
          {" · "}
          <a href={CK_PHONE_SMS} className="hover:underline">
            Text
          </a>
        </p>
      </div>
    </main>
  );
}
