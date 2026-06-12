/**
 * /leads/digest — public landing page for the KC Motivated Seller Digest.
 *
 * Sells the existing Monday 7am brief (app/api/cron/leads-monday-digest) to
 * KC-metro listing agents as a $199/mo self-serve subscription. Signup form
 * → POST /api/leads/digest/subscribe → Stripe Checkout → webhook activates →
 * the agent is on the next Monday send with zero operator involvement.
 *
 * Honesty rules baked in: no fake testimonials, no fake member counters, no
 * exclusivity claims (ZIPs are NOT exclusive in v1 and the FAQ says so).
 */

import DigestSignupForm from "./signup-form";

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "We watch the signals",
    desc: "MLS activity across the KC metro, probate filings, distress signals, and county records — monitored continuously, not pulled once a quarter.",
  },
  {
    num: "02",
    title: "Every property gets scored",
    desc: "Each candidate runs through a motivation model and lands a 0–100 score with the flags that drove it: probate, absentee owner, long days-on-market, price cuts, and more.",
  },
  {
    num: "03",
    title: "Top 10 in YOUR ZIPs",
    desc: "Monday 7am, your inbox: the ten highest-scoring leads inside your farm ZIPs from the past week — with owner contact info where our research found it.",
  },
  {
    num: "04",
    title: "Scripts included",
    desc: "Every lead ships with a ready-to-send outreach script, pre-filled with the owner's name and address. Pick three, make the calls, book the appointment.",
  },
];

const SAMPLE_FLAGS = ["probate", "absentee owner", "94 DOM"];

const FAQ = [
  {
    q: "When do the emails arrive?",
    a: "Every Monday at 7:00am Central. Your first digest lands the Monday after you subscribe. If a given week genuinely produces zero qualifying leads in your ZIPs, we skip the send rather than pad it with junk.",
  },
  {
    q: "Where does the data come from?",
    a: "Heartland MLS activity, county records (deeds, assessor, probate court filings), and public distress signals, combined and scored by our research pipeline. Owner phone/email is included when our research surfaces it — we never guarantee contact info on every lead.",
  },
  {
    q: "Are my ZIP codes exclusive?",
    a: "Not in v1 — we're being straight with you. If another agent farms the same ZIP, you may both receive overlapping leads. Speed and follow-up win; exclusivity may come later as a separate tier.",
  },
  {
    q: "Can I cancel?",
    a: "Anytime. Manage or cancel your subscription through the Stripe billing portal link on any receipt, or click “Pause your digest” in the footer of any Monday email to stop sends immediately. No contracts, no minimum term.",
  },
  {
    q: "Can I change my farm ZIPs later?",
    a: "Yes — reply to any digest email with the change and it's applied before the next Monday send.",
  },
  {
    q: "What does “founding rate” mean?",
    a: "The first 5 paying agents get $199/mo locked in for as long as they stay subscribed. After that, new subscriptions are $299/mo. That's the whole offer — no countdown timers, no fake scarcity.",
  },
];

function SampleLeadCard() {
  return (
    <div className="dg-card relative overflow-hidden p-5">
      <div className="dg-sample-band absolute right-[-44px] top-[18px] rotate-45 px-12 py-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "#9a4a00" }}
        >
          Sample
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 pr-16">
        <div className="dg-serif text-base font-bold" style={{ color: "var(--dg-navy)" }}>
          #1 · 1•• NE Sample St, Independence, MO 64052
        </div>
        <span className="dg-score shrink-0">87/100</span>
      </div>
      <div className="mt-2 text-sm" style={{ color: "var(--dg-ink)" }}>
        <b>M••• Sample (est.)</b> · age 70s · mails to: P.O. Box ••• , Lee&apos;s Summit MO
      </div>
      <div className="mt-1 text-sm" style={{ color: "var(--dg-muted)" }}>
        $165,000 · 3 bd · 1 ba · 1,040 sqft · 94 DOM
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SAMPLE_FLAGS.map((f) => (
          <span key={f} className="dg-flag">
            {f}
          </span>
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--dg-ink)" }}>
        Estate filed in Jackson County probate in April; the listed owner&apos;s mailing
        address moved out of the property two tax cycles ago. Listing has sat 94 days
        with one price cut — classic tired-listing-plus-life-event combination.
      </p>
      <div
        className="mt-4 rounded-md border-l-[3px] px-3 py-2 text-sm leading-relaxed"
        style={{
          borderColor: "var(--dg-navy)",
          background: "#f1f5f9",
          color: "var(--dg-ink)",
          fontFamily: "var(--dg-serif)",
        }}
      >
        &ldquo;Hi M•••, I&apos;m [your name] — I work the 64052 area and noticed your home
        on NE Sample St came up in some public records that caught my eye. No pressure
        at all, just wanted to introduce myself in case you&apos;ve ever thought about
        your options…&rdquo;
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--dg-amber)" }}>
        Sample lead — illustrative data, not a real property
      </p>
    </div>
  );
}

export default function DigestLandingPage() {
  return (
    <div className="dg-sheet mx-auto my-2 max-w-[1040px]">
      {/* ── Masthead / hero ── */}
      <header className="px-6 pb-12 pt-10 sm:px-12 sm:pt-14">
        <div className="dg-rule" aria-hidden="true" />
        <div className="mt-6 flex items-baseline justify-between gap-4">
          <p className="dg-kicker">tolley.io · Kansas City metro</p>
          <p className="text-xs font-semibold" style={{ color: "var(--dg-muted)" }}>
            Mondays · 7:00am CT
          </p>
        </div>
        <h1
          className="dg-serif mt-5 text-4xl font-black leading-[1.05] sm:text-6xl"
          style={{ color: "var(--dg-navy)" }}
        >
          Your Monday morning listing leads,{" "}
          <em style={{ color: "var(--dg-amber)" }}>ranked.</em>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--dg-muted)" }}>
          The <b style={{ color: "var(--dg-ink)" }}>KC Motivated Seller Digest</b>: 10
          motivated-seller leads in <b style={{ color: "var(--dg-ink)" }}>your</b> farm ZIP
          codes, every Monday at 7am — scored, flagged, with owner contact info where we
          found it, and a script you can send before your first coffee.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href="#signup" className="dg-btn dg-serif text-lg">
            Get the digest — $199/mo
          </a>
          <a
            href="#sample"
            className="text-sm font-semibold underline underline-offset-4"
            style={{ color: "var(--dg-navy)" }}
          >
            See what a lead looks like ↓
          </a>
        </div>
        <div className="dg-rule mt-10" aria-hidden="true" />
      </header>

      {/* ── How it works ── */}
      <section className="px-6 pb-14 sm:px-12">
        <p className="dg-kicker">How it works</p>
        <h2 className="dg-h2 mt-2">From county records to your inbox</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.num} className="dg-card p-6">
              <div
                className="dg-serif text-3xl font-black"
                style={{ color: "var(--dg-amber)" }}
              >
                {step.num}
              </div>
              <h3 className="dg-serif mt-3 text-lg font-bold" style={{ color: "var(--dg-navy)" }}>
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--dg-muted)" }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Sample lead card ── */}
      <section id="sample" className="scroll-mt-8 px-6 pb-14 sm:px-12">
        <p className="dg-kicker">What you get</p>
        <h2 className="dg-h2 mt-2">Each lead arrives like this</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--dg-muted)" }}>
          Ten cards per email, ranked by motivation score. The example below is a{" "}
          <b>fabricated sample</b> so we don&apos;t put a real homeowner on a public page —
          real digests carry full addresses and real research.
        </p>
        <div className="mx-auto mt-6 max-w-xl">
          <SampleLeadCard />
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="px-6 pb-14 sm:px-12">
        <p className="dg-kicker">Pricing</p>
        <h2 className="dg-h2 mt-2">One plan. Founding rate while it lasts.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div
            className="dg-card p-7"
            style={{ borderColor: "var(--dg-navy)", borderWidth: 2 }}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="dg-serif text-xl font-bold" style={{ color: "var(--dg-navy)" }}>
                Founding agent
              </h3>
              <span className="dg-flag">first 5 agents</span>
            </div>
            <div className="dg-serif mt-4 text-5xl font-black" style={{ color: "var(--dg-ink)" }}>
              $199
              <span className="text-lg font-semibold" style={{ color: "var(--dg-muted)" }}>
                /mo
              </span>
            </div>
            <ul className="mt-5 space-y-2 text-sm" style={{ color: "var(--dg-ink)" }}>
              <li>✓ 10 ranked leads in your farm ZIPs, every Monday 7am</li>
              <li>✓ Up to 7 farm ZIP codes</li>
              <li>✓ Owner contact info where research finds it</li>
              <li>✓ Ready-to-send outreach script on every lead</li>
              <li>✓ Rate locked for as long as you stay subscribed</li>
              <li>✓ Cancel anytime</li>
            </ul>
          </div>
          <div className="dg-card p-7 opacity-80">
            <h3 className="dg-serif text-xl font-bold" style={{ color: "var(--dg-navy)" }}>
              Standard
            </h3>
            <div className="dg-serif mt-4 text-5xl font-black" style={{ color: "var(--dg-ink)" }}>
              $299
              <span className="text-lg font-semibold" style={{ color: "var(--dg-muted)" }}>
                /mo
              </span>
            </div>
            <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--dg-muted)" }}>
              Same digest, same coverage — the price after the five founding seats are
              taken. We don&apos;t run countdown timers or fake &ldquo;2 spots left!&rdquo;
              counters; when the founding seats fill, this page simply switches to $299.
            </p>
          </div>
        </div>
      </section>

      {/* ── Coverage + signup ── */}
      <section id="signup" className="scroll-mt-8 px-6 pb-14 sm:px-12">
        <p className="dg-kicker">Start your subscription</p>
        <h2 className="dg-h2 mt-2">Pick your ZIPs. That&apos;s the whole setup.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--dg-muted)" }}>
          Coverage today is the eastern Jackson County + KC footprint our pipeline
          actively watches. If your farm isn&apos;t listed, don&apos;t subscribe yet —
          email us and we&apos;ll tell you honestly whether it&apos;s coming.
        </p>
        <div className="mt-6">
          <DigestSignupForm />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 pb-14 sm:px-12">
        <p className="dg-kicker">Fair questions</p>
        <h2 className="dg-h2 mt-2">FAQ</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="dg-faq group">
              <summary className="flex items-center justify-between px-5 py-4">
                <span className="dg-serif text-base font-bold" style={{ color: "var(--dg-navy)" }}>
                  {item.q}
                </span>
                <span
                  className="dg-serif text-xl transition-transform group-open:rotate-45"
                  style={{ color: "var(--dg-amber)" }}
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "var(--dg-muted)" }}>
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="border-t px-6 py-8 text-center text-xs sm:px-12"
        style={{ borderColor: "var(--dg-line)", color: "var(--dg-muted)" }}
      >
        <div className="dg-rule mx-auto mb-6 max-w-xs" aria-hidden="true" />
        <p>
          KC Motivated Seller Digest · built and curated in Independence, MO by{" "}
          <a href="https://www.tolley.io" className="underline" style={{ color: "var(--dg-navy)" }}>
            tolley.io
          </a>
        </p>
        <p className="mt-2">
          Lead data is compiled from public records and MLS activity for licensed
          real-estate professionals. Not a consumer credit report; not affiliated with
          any county office.
        </p>
      </footer>
    </div>
  );
}
