// /sales/terms — the plain-talk handshake terms for Launchpad operators.
// Charcoal/safety-orange, self-contained (no shared legal shell — this reads
// like Jared talking, not a EULA). Linked from the claim signup T&C checkbox.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "The Handshake — Launchpad Operator Terms | Tolley.io",
  description:
    "Plain-English terms for running a business on The Launchpad: the cut, the buyout, who owns what, and the kill-switch. No fine print.",
};

export const LAUNCHPAD_TERMS_UPDATED = "July 4, 2026";

const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: "1. What this is",
    p: [
      "The Launchpad lets you run a real business on Jared Tolley's rails — an existing LLC, a working Stripe account, a website, supplier and delivery access, and marketing automation — before you could get any of that on your own. This is a handshake, not a loan, not a course, and not an MLM. Jared decides who he builds with.",
    ],
  },
  {
    h: "2. Who owns what, while you're on the rails",
    p: [
      "While you operate under The Launchpad, the LLC, the Stripe account, the domain, and the supplier accounts belong to Jared/Tolley.io. Your customers, your reputation, and the work you do are yours in every way that matters — and they follow you when you buy out (see §5).",
      "Money runs through Jared's Stripe. You get paid out on the schedule the two of you agree on. No customer ever pays you into an account you don't have — that's the whole point.",
    ],
  },
  {
    h: "3. The cut",
    p: [
      "Jared takes a small cut of sales while you're running on his rails. The goal is volume, not squeezing you — there are no upfront fees and nothing to buy to get started. The exact cut is agreed in your handshake before your Buy button turns on.",
      "Sometimes a small startup investment (usually $500–$1,000) covers inventory, a mower, or first materials. That's discussed up front too — never a surprise.",
    ],
  },
  {
    h: "4. The kill-switch",
    p: [
      "Jared can pause a storefront's ordering at any time — for fraud, chargebacks, safety, a supplier problem, or anything that puts the shared rails at risk. Your site stays up; ordering just goes quiet until it's sorted. This protects every operator on the platform, including you.",
    ],
  },
  {
    h: "5. The Buyout Button",
    p: [
      "Once you're established, you can buy yourself out: the clients, the history, the site, the whole operation becomes yours to run independently. A small run that fizzled is a $0–100 buyout. A machine doing $5K/month is worth tens of thousands — and you walk away the owner.",
      "You're never forced to buy out. Staying on the rails forever is a perfectly good outcome. Buyout price is based on what you've built and is agreed in writing when you request it.",
    ],
  },
  {
    h: "6. Your responsibilities",
    p: [
      "Do honest work, deliver what you sell, and don't use the platform for anything illegal. Keep Jared in the loop on problems early. Treat customers right — their reviews and repeat business are the asset you're building.",
    ],
  },
  {
    h: "7. No legal or financial advice",
    p: [
      "This page explains how The Launchpad works in plain language. It isn't legal, tax, or financial advice, and it isn't a substitute for a formal agreement. Your handshake and any written buyout terms are the controlling documents. Questions? Text Jared before you sign anything.",
    ],
  },
];

export default function LaunchpadTermsPage() {
  return (
    <main
      className="min-h-screen px-5 py-14 sm:px-8"
      style={{ backgroundColor: "#141518", color: "#f4f2ee" }}
    >
      <div className="mx-auto w-full max-w-3xl">
        <p
          className="text-[0.7rem] font-semibold uppercase tracking-[0.3em]"
          style={{ color: "#ff8842" }}
        >
          The Launchpad · Tolley.io
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          The Handshake
        </h1>
        <p className="mt-3 text-sm" style={{ color: "#a7a49d" }}>
          How running a business on the rails actually works. Last updated{" "}
          {LAUNCHPAD_TERMS_UPDATED}.
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-bold" style={{ color: "#ff6a13" }}>
                {s.h}
              </h2>
              {s.p.map((para, i) => (
                <p key={i} className="mt-2 text-[0.95rem] leading-7" style={{ color: "#d8d5cf" }}>
                  {para}
                </p>
              ))}
            </section>
          ))}
        </div>

        <div
          className="mt-12 rounded-2xl p-5 text-sm"
          style={{ backgroundColor: "#1c1e22", border: "1px solid rgba(255,106,19,0.3)" }}
        >
          <p style={{ color: "#d8d5cf" }}>
            Ready to run one?{" "}
            <Link href="/sales" style={{ color: "#ff8842", fontWeight: 700 }}>
              Start on The Launchpad →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
