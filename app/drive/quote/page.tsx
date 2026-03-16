import { DispatchQuoteForm } from "@/components/dispatch/dispatch-quote-form";

export const metadata = {
  title: "Get a Quote | Red Alert Dispatch",
  description:
    "Instant delivery pricing — see exactly what you pay, what your driver earns, and how much you save vs Dispatch, Roadie, and GoShare.",
};

export default function QuotePage() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto text-center mb-8">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          Instant Delivery Quote
        </h1>
        <p className="mt-3 text-lg text-gray-400">
          Transparent pricing — see your price, driver pay, and savings vs
          industry apps. No hidden fees, no 60% markup.
        </p>
      </div>
      <DispatchQuoteForm />
    </main>
  );
}
