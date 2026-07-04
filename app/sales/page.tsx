import Image from "next/image";
import {
  LP_ARSENAL,
  LP_STEPS,
  LP_PLAYS,
  LP_PHONE,
  LP_PHONE_TEL,
  LP_PHONE_SMS,
} from "@/lib/sales";
import { LaunchpadIntakeForm } from "@/components/launchpad/intake-form";

// Real businesses already running on Jared's rails. Screenshots captured
// from the live pages — no invented numbers, only verified outcomes.
interface LpReceipt {
  name: string;
  href: string;
  shot: string;
  outcome: string;
}

const LP_RECEIPTS: LpReceipt[] = [
  {
    name: "Crazy Bin Store #2",
    href: "/crazybins",
    shot: "/sales/receipts/crazybins.jpg",
    outcome: "Client site built from their Facebook content.",
  },
  {
    name: "13:13 Weddings & Events",
    href: "/e-and-t",
    shot: "/sales/receipts/e-and-t.jpg",
    outcome: "Wedding planner's full site, built same-day from a brochure.",
  },
  {
    name: "Tolley Cleanouts",
    href: "/cleanouts",
    shot: "/sales/receipts/cleanouts.jpg",
    outcome: "Live service line with quote requests.",
  },
  {
    name: "W/D Rentals",
    href: "/wd",
    shot: "/sales/receipts/wd.jpg",
    outcome: "50 rental units, real monthly recurring revenue.",
  },
  {
    name: "The Shop",
    href: "/shop",
    shot: "/sales/receipts/shop.jpg",
    outcome: "595+ items sold through this pipeline.",
  },
  {
    name: "Ruthann's Kitchen",
    href: "/food",
    shot: "/sales/receipts/food.jpg",
    outcome: "Subscription product, live at $39/yr.",
  },
];

export default function SalesPage() {
  return (
    <main className="relative z-10 min-h-screen overflow-x-hidden">
      {/* Sticky strip */}
      <div className="lp-strip sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-2.5 text-center">
        <span className="lp-mono text-xs uppercase text-[color:var(--lp-amber)]">
          The Launchpad
        </span>
        <span className="text-white/20">|</span>
        <a href="#intake" className="text-xs font-semibold text-[color:var(--lp-paper)] underline underline-offset-2 hover:text-[color:var(--lp-amber)]">
          Tell me your idea
        </a>
      </div>

      {/* ─── HERO ─── */}
      <section className="lp-hero relative overflow-hidden px-5 pt-16 pb-20 text-center sm:pt-24 sm:pb-24">
        <div className="lp-bulb h-72 w-72" style={{ top: "-4rem", left: "50%", transform: "translateX(-50%)" }} aria-hidden="true" />
        <div className="lp-enter mx-auto max-w-3xl" style={{ "--enter-delay": "0s" } as React.CSSProperties}>
          <p className="lp-kicker">Tolley.io · Independence, MO</p>
          <h1 className="lp-display mt-5 text-4xl text-[color:var(--lp-paper)] sm:text-6xl">
            No license. No bank account.{" "}
            <span className="text-[color:var(--lp-amber)]">A record.</span>
            <br />
            You can still start.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[color:var(--lp-steel)] sm:text-xl">
            You bring the idea and the hustle. I bring everything else.
            You can be selling <span className="lp-marker text-2xl">tonight.</span>
          </p>

          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="#intake" className="lp-btn-primary rounded px-8 py-4 text-lg font-bold">
              Tell Me Your Idea
            </a>
            <a href={LP_PHONE_SMS} className="lp-btn-secondary rounded px-8 py-4 text-lg font-bold">
              Text {LP_PHONE}
            </a>
          </div>

          <p className="lp-mono mx-auto mt-7 max-w-md text-xs uppercase tracking-wider text-[color:var(--lp-steel)] opacity-60">
            Not a course. Not a loan. Not an MLM. A platform and a handshake.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-20 px-5 pb-24 sm:px-8">
        {/* One-liner banner */}
        <section className="lp-oneliner lp-enter -mx-5 px-5 py-10 sm:-mx-8 sm:px-8" style={{ "--enter-delay": "0.05s" } as React.CSSProperties}>
          <p className="lp-display mx-auto max-w-3xl text-center text-2xl leading-tight text-[color:var(--lp-paper)] sm:text-4xl">
            &ldquo;I&apos;m not here to take a big cut &mdash;{" "}
            <span className="text-[color:var(--lp-amber)]">my goal is volume.</span>
            <br />
            Focus on what you&apos;re good at.&rdquo;
          </p>
          <p className="lp-mono mt-4 text-center text-xs uppercase tracking-widest text-[color:var(--lp-steel)]">
            — Jared, Tolley.io
          </p>
        </section>

        {/* The Arsenal */}
        <section className="lp-enter" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
          <p className="lp-kicker text-center">What I bring to the table</p>
          <h2 className="lp-display mt-2 mb-2 text-center text-3xl text-[color:var(--lp-paper)] sm:text-4xl">
            The Arsenal
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-center text-sm text-[color:var(--lp-steel)]">
            All of this is real, already built, and already running. Nothing here is theory.
          </p>
          <div className="lp-pegboard grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
            {LP_ARSENAL.map((item) => (
              <div key={item.label} className="lp-tool-card p-5">
                <h3 className="lp-display text-base text-[color:var(--lp-amber)]">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--lp-steel)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="lp-enter" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <p className="lp-kicker text-center">How it works</p>
          <h2 className="lp-display mt-2 mb-8 text-center text-3xl text-[color:var(--lp-paper)] sm:text-4xl">
            Five Steps. One Handshake.
          </h2>
          <div className="space-y-4">
            {LP_STEPS.map((step) =>
              step.highlight ? (
                <div key={step.num} className="lp-step lp-step-buyout flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
                  <div className="flex items-center gap-4 sm:flex-col sm:items-center">
                    <span className="lp-step-num">{step.num}</span>
                    <div
                      className="lp-buyout-button px-6 py-4 text-sm sm:px-7 sm:text-base"
                      role="img"
                      aria-label="The Buyout Button"
                    >
                      Buy Yourself Out
                    </div>
                  </div>
                  <div>
                    <h3 className="lp-display text-lg text-[color:var(--lp-paper)] sm:text-xl">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--lp-steel)]">{step.desc}</p>
                  </div>
                </div>
              ) : (
                <div key={step.num} className="lp-step flex items-start gap-5 p-6">
                  <span className="lp-step-num">{step.num}</span>
                  <div>
                    <h3 className="lp-display text-lg text-[color:var(--lp-paper)]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[color:var(--lp-steel)]">{step.desc}</p>
                  </div>
                </div>
              ),
            )}
          </div>
        </section>

        {/* Example plays — corkboard */}
        <section className="lp-enter" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
          <p className="lp-kicker text-center">Real ones already running this way</p>
          <h2 className="lp-display mt-2 mb-8 text-center text-3xl text-[color:var(--lp-paper)] sm:text-4xl">
            Example Plays
          </h2>
          <div className="lp-corkboard grid gap-8 p-6 sm:grid-cols-3 sm:p-10">
            {LP_PLAYS.map((play) => (
              <div key={play.tag} className="lp-index-card p-6">
                <span className="lp-index-tag block pb-2">{play.tag}</span>
                <h3 className="lp-display mt-3 text-lg">{play.title}</h3>
                <p className="mt-2 text-sm leading-relaxed opacity-80">{play.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The Receipts — proof, not promises */}
        <section className="lp-enter" style={{ "--enter-delay": "0.22s" } as React.CSSProperties}>
          <p className="lp-kicker text-center">Proof, not promises</p>
          <h2 className="lp-display mt-2 mb-2 text-center text-3xl text-[color:var(--lp-paper)] sm:text-4xl">
            I&apos;ve Done This Before. These Are Live Right Now.
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-center text-sm text-[color:var(--lp-steel)]">
            Real businesses, running on the same rails you&apos;d be using. Click through — they&apos;re live.
          </p>
          <div className="lp-receipts-grid">
            {LP_RECEIPTS.map((r) => (
              <a
                key={r.href}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="lp-receipt-card"
              >
                <Image
                  src={r.shot}
                  alt={`${r.name} — live at tolley.io${r.href}`}
                  width={1200}
                  height={750}
                  className="lp-receipt-shot"
                />
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <span className="lp-receipt-live">Live now</span>
                  <h3 className="lp-display text-base text-[color:var(--lp-paper)]">{r.name}</h3>
                  <p className="text-sm leading-relaxed text-[color:var(--lp-steel)]">{r.outcome}</p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Trust / handshake */}
        <section className="lp-enter" style={{ "--enter-delay": "0.28s" } as React.CSSProperties}>
          <div className="lp-not-panel flex flex-col items-center gap-6 p-8 text-center sm:flex-row sm:text-left sm:p-12">
            <div className="lp-stamp shrink-0" aria-hidden="true">
              <span className="text-2xl leading-none">·</span>
              <span className="text-sm">Handshake</span>
              <span className="text-2xl leading-none">·</span>
            </div>
            <div>
              <h2 className="lp-display text-2xl text-[color:var(--lp-paper)] sm:text-3xl">
                This is a handshake, not charity.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[color:var(--lp-steel)]">
                This is a deal between two people who both have something to gain. I&apos;ve been
                where you are — broke, overwhelmed, locked out of the normal ways in. I&apos;m not
                doing you a favor; I&apos;m betting on you, and I expect to make money doing it.
                No pity, no lecture. Just a chance to start.
              </p>
              <p className="mt-4 text-sm text-[color:var(--lp-steel)] opacity-80">
                Not a course. Not coaching-for-sale. Not a loan, not an MLM. No get-rich promises
                — terms formalize in writing once things get serious.
              </p>
            </div>
          </div>
        </section>

        {/* Intake */}
        <section id="intake" className="lp-enter scroll-mt-20" style={{ "--enter-delay": "0.33s" } as React.CSSProperties}>
          <p className="lp-kicker text-center">Start here</p>
          <h2 className="lp-display mt-2 mb-3 text-center text-3xl text-[color:var(--lp-paper)] sm:text-4xl">
            Fill Out the Work Order
          </h2>
          <p className="mx-auto mb-9 max-w-md text-center text-sm text-[color:var(--lp-steel)]">
            I read every one of these myself. Tell me the idea and what&apos;s in your way — I&apos;ll
            call or text back, usually within a day.
          </p>
          <LaunchpadIntakeForm />
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-5 py-8 text-center">
        <p className="lp-mono text-xs text-[color:var(--lp-steel)] opacity-60">
          &copy; {new Date().getFullYear()} The Launchpad &middot; part of{" "}
          <a href="https://www.tolley.io" className="hover:text-[color:var(--lp-amber)]">
            tolley.io
          </a>{" "}
          &middot;{" "}
          <a href={LP_PHONE_TEL} className="hover:text-[color:var(--lp-amber)]">
            {LP_PHONE}
          </a>
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-[color:var(--lp-steel)] opacity-40">
          <a href="/cleanouts" className="hover:opacity-100">Cleanouts</a>
          <a href="/wd" className="hover:opacity-100">W/D Rental</a>
          <a href="/shop" className="hover:opacity-100">Shop</a>
          <a href="/homes" className="hover:opacity-100">Real Estate</a>
          <a href="/start" className="hover:opacity-100">All Tolley.io</a>
        </div>
      </footer>
    </main>
  );
}
