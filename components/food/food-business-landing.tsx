import Link from "next/link";

/**
 * /food/business — B2B white-label pitch page.
 *
 * Repositions the Ruthann's Kitchen engine from a $39/yr DTC product into a
 * white-label meal-plan + grocery platform sold to food businesses
 * (nutritionists, meal-prep companies, trainers, personal chefs) at
 * $99–$299/mo. This is the asset to put in front of a prospect — it reuses
 * the consumer engine but flips the buyer to a business with 30–100x the ACV.
 */

const DEMO_MAILTO =
  "mailto:jared@yourkchomes.com" +
  "?subject=" +
  encodeURIComponent("Ruthann's Kitchen — white-label demo") +
  "&body=" +
  encodeURIComponent(
    "Hi Jared,\n\nI run a [nutrition practice / meal-prep company / coaching business] and I'd like a 15-minute demo of the branded client meal-plan platform.\n\nBusiness name:\nWebsite:\nRough # of clients:\n\nThanks!",
  );

const WHO_ITS_FOR: { emoji: string; title: string; description: string; color: string }[] = [
  {
    emoji: "🥗",
    title: "Dietitians & Nutritionists",
    description:
      "You hand clients meal plans as PDFs and chase them on text. Give them a branded app instead — plans they can actually cook from, grocery lists that build themselves, and pantry tracking that keeps them on protocol between sessions.",
    color: "var(--food-mint)",
  },
  {
    emoji: "🍱",
    title: "Meal-Prep Companies",
    description:
      "Turn your weekly menu into a self-serve portal. Clients pick meals, you get the consolidated order list, and the AI handles dietary swaps so you stop fielding a hundred 'can I sub the chicken' texts.",
    color: "var(--food-pink)",
  },
  {
    emoji: "💪",
    title: "Trainers & Macro Coaches",
    description:
      "Training is half the result — nutrition is the rest. Bundle a branded meal planner into your coaching package, set macro-anchored plans per client, and finally have eyes on what they're actually eating.",
    color: "var(--food-lavender)",
  },
  {
    emoji: "👨‍🍳",
    title: "Personal Chefs",
    description:
      "Your clients want 'what you make, at home, when you're not there.' Push your recipes into their library, generate non-repeating weeks in your style, and auto-build the shopping list for their household.",
    color: "var(--food-peach)",
  },
];

const CLIENT_GETS: { emoji: string; title: string; description: string; color: string }[] = [
  {
    emoji: "📅",
    title: "Non-repeating weekly plans",
    description:
      "AI builds a fresh week every time — anchored to the plan you set, never the same 12 recipes on a loop.",
    color: "var(--food-pink)",
  },
  {
    emoji: "🛒",
    title: "Auto grocery lists",
    description:
      "Every plan becomes a deduplicated, aisle-sorted shopping list with real local prices — formatted for Walmart and Kroger curbside.",
    color: "var(--food-lavender)",
  },
  {
    emoji: "🗄️",
    title: "Pantry & expiry tracking",
    description:
      "Fridge, freezer, pantry. Low-stock and expiry alerts. The thing that keeps clients compliant between your sessions.",
    color: "var(--food-mint)",
  },
  {
    emoji: "🧬",
    title: "Per-person dietary profiles",
    description:
      "Allergies, restrictions, dislikes, macros, age — respected automatically across every plan you push.",
    color: "var(--food-peach)",
  },
];

const YOU_GET: { emoji: string; title: string; description: string; color: string }[] = [
  {
    emoji: "🎨",
    title: "Your brand, not ours",
    description:
      "Your logo, your colors, your domain. Clients see your business — the engine stays invisible. It looks like you built it.",
    color: "var(--food-rose-gold)",
  },
  {
    emoji: "👥",
    title: "A client roster you control",
    description:
      "One dashboard for every client. Set their plan, watch their adherence, onboard a new one in under two minutes.",
    color: "var(--food-pink)",
  },
  {
    emoji: "🤖",
    title: "AI that does the busywork",
    description:
      "Recipe import, plan generation, grocery math, receipt scanning — automated. You spend your time on clients, not spreadsheets.",
    color: "var(--food-lavender)",
  },
  {
    emoji: "🚀",
    title: "Live in days, not months",
    description:
      "We stand up your branded instance and migrate your existing recipes. No developers, no app-store fight, no build cost.",
    color: "var(--food-mint)",
  },
];

const TIERS: {
  name: string;
  price: string;
  period: string;
  blurb: string;
  features: string[];
  cta: string;
  featured?: boolean;
}[] = [
  {
    name: "Solo",
    price: "$99",
    period: "/month",
    blurb: "Independent dietitians, coaches & chefs",
    features: [
      "Up to 25 active clients",
      "Your logo + brand colors",
      "Branded client app",
      "AI meal plans & grocery lists",
      "Recipe import & library",
      "Email support",
    ],
    cta: "Book a demo",
  },
  {
    name: "Studio",
    price: "$249",
    period: "/month",
    blurb: "Practices & meal-prep companies",
    features: [
      "Up to 150 active clients",
      "Everything in Solo",
      "Custom subdomain",
      "Client adherence dashboard",
      "Consolidated order list (meal-prep)",
      "Priority support",
    ],
    cta: "Book a demo",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    blurb: "Multi-location & franchises",
    features: [
      "Unlimited clients",
      "Everything in Studio",
      "Custom domain + SSO",
      "API access",
      "White-glove migration",
      "Dedicated account contact",
    ],
    cta: "Talk to us",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How is this different from just using a generic meal-planner app?",
    a: "Generic apps are built for the end-consumer and bury your brand. This is built for the business in the middle. You set the plans, you own the client relationship, and every screen wears your brand — not ours. Your clients never know there's an engine underneath.",
  },
  {
    q: "Do I need a developer to set this up?",
    a: "No. We stand up your branded instance, load your logo and colors, and migrate any existing recipe library (including old Yummly or PlateJoy exports). You're live in days with zero engineering on your side.",
  },
  {
    q: "Can I import the recipes and plans I already use?",
    a: "Yes. Upload a Yummly/PlateJoy export or a spreadsheet and our AI cleans it up, fills in missing metadata, and drops everything into your library. Your years of work come with you.",
  },
  {
    q: "How do my clients pay — through me or through you?",
    a: "Through you. You charge your clients whatever you want (or bundle it into your existing coaching/prep package). Your flat monthly platform fee is all you pay us — your client revenue is yours.",
  },
  {
    q: "What does onboarding a new client look like?",
    a: "Under two minutes: add their name, set their dietary profile and plan target, and send the invite. They log into your branded app and their first non-repeating week is ready.",
  },
  {
    q: "Is my client data private and portable?",
    a: "Yes. Each business is isolated, client data is never shared across tenants, and you can export everything as JSON anytime. No lock-in.",
  },
];

export function FoodBusinessLanding() {
  return (
    <div className="food-landing">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="food-landing-hero">
        <div className="food-landing-hero-inner">
          <div className="food-landing-badge">
            <span aria-hidden="true">🏷️</span>
            White-label · your brand, our engine
          </div>
          <h1 className="food-landing-h1">
            Stop sending meal plans as{" "}
            <span className="food-landing-emph">PDFs</span>.
          </h1>
          <p className="food-landing-sub">
            Give your clients a branded app instead. Ruthann&apos;s Kitchen is a
            white-label meal-planning &amp; grocery platform for nutritionists,
            meal-prep companies, trainers and chefs. Your logo, your clients,
            your pricing — our AI does the busywork. Live in days.
          </p>
          <div className="food-landing-cta-row">
            <a
              href={DEMO_MAILTO}
              className="food-btn food-btn-primary food-glow food-landing-cta-primary"
            >
              Book a 15-min demo
            </a>
            <Link
              href="#pricing"
              className="food-btn food-btn-secondary food-landing-cta-secondary"
            >
              See pricing
            </Link>
          </div>
          <p className="food-landing-hero-micro">
            From $99/month · we migrate your recipes · cancel anytime
          </p>
        </div>
      </section>

      {/* ─── Who it's for ─────────────────────────────────────── */}
      <section className="food-landing-section">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">Built for the business in the middle</h2>
          <p className="food-landing-h2-sub">
            If you tell people what to eat for a living, this is your platform.
          </p>
          <div className="food-landing-feature-grid">
            {WHO_ITS_FOR.map((f) => (
              <div key={f.title} className="food-landing-feature-card">
                <div
                  className="food-landing-feature-emoji"
                  style={{ background: `${f.color}18` }}
                >
                  {f.emoji}
                </div>
                <h3 className="food-landing-feature-title">{f.title}</h3>
                <p className="food-landing-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── What your clients get ────────────────────────────── */}
      <section className="food-landing-band">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">What your clients get</h2>
          <p className="food-landing-band-lede">
            The same engine a real family uses every week — now wearing{" "}
            <strong>your</strong> brand.
          </p>
          <div className="food-landing-feature-grid">
            {CLIENT_GETS.map((f) => (
              <div key={f.title} className="food-landing-feature-card">
                <div
                  className="food-landing-feature-emoji"
                  style={{ background: `${f.color}18` }}
                >
                  {f.emoji}
                </div>
                <h3 className="food-landing-feature-title">{f.title}</h3>
                <p className="food-landing-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── What you get ─────────────────────────────────────── */}
      <section className="food-landing-section">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">What you get</h2>
          <p className="food-landing-h2-sub">
            A platform you control, without the cost of building one.
          </p>
          <div className="food-landing-feature-grid">
            {YOU_GET.map((f) => (
              <div key={f.title} className="food-landing-feature-card">
                <div
                  className="food-landing-feature-emoji"
                  style={{ background: `${f.color}18` }}
                >
                  {f.emoji}
                </div>
                <h3 className="food-landing-feature-title">{f.title}</h3>
                <p className="food-landing-feature-desc">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="food-landing-section">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">Flat monthly platform fee</h2>
          <p className="food-landing-h2-sub">
            One fee to us. Charge your clients whatever you like — that revenue
            is yours.
          </p>
          <div className="food-biz-pricing">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`food-biz-tier${tier.featured ? " food-biz-tier-featured" : ""}`}
              >
                {tier.featured && (
                  <div className="food-biz-tier-flag">Most popular</div>
                )}
                <div className="food-biz-tier-name">{tier.name}</div>
                <div className="food-biz-tier-blurb">{tier.blurb}</div>
                <div className="food-biz-tier-price">
                  <span className="food-biz-tier-amount">{tier.price}</span>
                  <span className="food-biz-tier-period">{tier.period}</span>
                </div>
                <ul className="food-landing-price-list">
                  {tier.features.map((feat) => (
                    <li key={feat}>✅ {feat}</li>
                  ))}
                </ul>
                <a
                  href={DEMO_MAILTO}
                  className={`food-btn ${
                    tier.featured ? "food-btn-primary food-glow" : "food-btn-secondary"
                  } food-biz-tier-cta`}
                >
                  {tier.cta} →
                </a>
              </div>
            ))}
          </div>
          <p className="food-landing-price-micro" style={{ textAlign: "center", marginTop: "1.5rem" }}>
            All plans include branded setup, recipe migration, and the full AI
            engine. No build fee, no per-seat surprises.
          </p>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────── */}
      <section className="food-landing-section food-landing-faq-section">
        <div className="food-landing-section-inner food-landing-faq-inner">
          <h2 className="food-landing-h2">Questions</h2>
          <div className="food-landing-faq">
            {FAQ.map((item) => (
              <details key={item.q} className="food-landing-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer CTA ───────────────────────────────────────── */}
      <section className="food-landing-footer-cta">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">
            Your clients already trust you. Give them the tool to match.
          </h2>
          <p className="food-landing-h2-sub">
            See your own logo on it in a 15-minute demo. We&apos;ll have a
            branded instance ready before the call ends.
          </p>
          <a
            href={DEMO_MAILTO}
            className="food-btn food-btn-primary food-glow food-landing-cta-primary"
          >
            Book a 15-min demo
          </a>
        </div>
      </section>
    </div>
  );
}
