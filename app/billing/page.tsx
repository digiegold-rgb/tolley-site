import { redirect } from "next/navigation";

// The billing manifest advertises /billing but only /billing/success existed
// (Stripe return page) — the registered URL 404'd (CTO audit 2026-07-06,
// Tier 2 #9). Account/subscription management lives at /settings.
export default function BillingPage() {
  redirect("/settings");
}
