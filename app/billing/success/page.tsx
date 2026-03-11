import Link from "next/link";

import { auth } from "@/auth";
import { getUserBillingState, isSubscribed } from "@/lib/billing-state";

export default async function BillingSuccessPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const billingState = userId ? await getUserBillingState(userId) : null;
  const subscribed = billingState ? isSubscribed(billingState) : false;

  return (
    <main className="portal-shell ambient-noise relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 w-full max-w-xl rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-7 text-center shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl">
        <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
          t-agent
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-white/95">You&apos;re subscribed.</h1>
        <p className="mt-2 text-sm leading-7 text-white/78">
          {subscribed
            ? "Billing is active and your account is ready."
            : "Your checkout is complete. Billing state is still syncing."}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/leads/dashboard"
            className="rounded-full border border-white/22 bg-white/[0.07] px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white uppercase transition hover:bg-white/[0.12]"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-white/18 bg-black/25 px-4 py-2 text-xs font-semibold tracking-[0.1em] text-white/86 uppercase transition hover:bg-black/35"
          >
            Back to Pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
