import Link from "next/link";

const FEATURES: {
  emoji: string;
  title: string;
  description: string;
  color: string;
}[] = [
  {
    emoji: "📅",
    title: "Non-repeating weekly plans",
    description:
      "The #1 complaint with every other meal planner: the same 12 recipes every week. Ours remembers what you cooked for the last month and deliberately doesn't suggest it again.",
    color: "var(--food-pink)",
  },
  {
    emoji: "🛒",
    title: "Grocery lists that know your aisles",
    description:
      "Meal plan → grocery list in one click. Deduplicated, aisle-sorted, price-estimated from your own receipt history. Formatted for Walmart and Kroger curbside pickup.",
    color: "var(--food-lavender)",
  },
  {
    emoji: "🗄️",
    title: "Pantry tracking that actually warns you",
    description:
      "Fridge, freezer, pantry, spice rack. Expiry tracking. Low-stock alerts. Recipe suggestions that use what's about to go bad — not what sounds nice in a glossy cookbook.",
    color: "var(--food-mint)",
  },
  {
    emoji: "📷",
    title: "Snap a receipt, track your real spend",
    description:
      "Point your camera at a Walmart or Aldi receipt. We'll read it, log every item, and build your real grocery budget — not the fantasy budget on the back of an envelope.",
    color: "var(--food-peach)",
  },
  {
    emoji: "👨‍👩‍👧‍👦",
    title: "Family taste profiles",
    description:
      "Each family member has their own dietary flags, allergies, dislikes, and age. Your picky 7-year-old and your gluten-free mother-in-law are both handled automatically.",
    color: "var(--food-rose-gold)",
  },
  {
    emoji: "💰",
    title: "Budget-first planning",
    description:
      "Anchored to real prices from your local Aldi or Walmart. Tell it $85 for the week and it'll actually plan for $85 — not $85 before you swapped the cheese for something fancier.",
    color: "var(--food-pink)",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "I was a Yummly user. Can I bring my recipes over?",
    a: "Yes. Upload your Yummly export .zip during onboarding and we'll clean up every recipe, guess missing metadata with AI, and drop them into your new library. PlateJoy exports work too. Your recipes don't have to die with the app.",
  },
  {
    q: "Is there really no monthly plan?",
    a: "No. $39 a year, period. A monthly plan at the industry rate ($5–$7) would actually cost you more — and it'd give us a reason to nickel-and-dime features behind tiers. One price, everything included, no upsells.",
  },
  {
    q: "How does the free trial work?",
    a: "30 days, full access, credit card up front. We'll email you two days before your trial ends so there are no surprises. Cancel in one click from Stripe's billing portal.",
  },
  {
    q: "Will it handle my dietary restrictions?",
    a: "Each family member has their own dietary flags (vegetarian, vegan, gluten-free, nut-free, dairy-free, kosher, halal, low-carb), custom dislikes, and allergies. The AI respects all of them across every meal plan and suggestion.",
  },
  {
    q: "Who built this?",
    a: "A solo developer building the app his wife (Ruthann) actually uses to plan meals for their family. Not VC-backed, not a growth-hack SaaS. Just a real tool that got polished enough to share.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep access until the end of your billing period. Your data stays in place — if you come back later, everything is still there. We also offer a one-click export of all your recipes as JSON anytime.",
  },
];

export function FoodLanding() {
  return (
    <div className="food-landing">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="food-landing-hero">
        <div className="food-landing-hero-inner">
          <div className="food-landing-badge">
            <span aria-hidden="true">💝</span>
            Your Yummly recipes don&apos;t have to die
          </div>
          <h1 className="food-landing-h1">
            The meal planner <span className="food-landing-emph">real</span>{" "}
            families actually use.
          </h1>
          <p className="food-landing-sub">
            Weekly plans that don&apos;t repeat the same 12 recipes. Grocery
            lists priced to your local Aldi. Pantry tracking that warns you
            before food goes bad. Built for busy moms — by someone whose wife
            uses it every week.
          </p>
          <div className="food-landing-cta-row">
            <Link
              href="/signup?callbackUrl=/food/billing&plan=food"
              className="food-btn food-btn-primary food-glow food-landing-cta-primary"
            >
              Start 30-day free trial
            </Link>
            <Link
              href="#pricing"
              className="food-btn food-btn-secondary food-landing-cta-secondary"
            >
              See pricing
            </Link>
          </div>
          <p className="food-landing-hero-micro">
            $39/year after trial · cancel anytime · no hidden upsells
          </p>
        </div>
      </section>

      {/* ─── Features grid ────────────────────────────────────── */}
      <section className="food-landing-section">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">
            Everything a family meal planner should be
          </h2>
          <p className="food-landing-h2-sub">
            Planning. Grocery. Pantry. Budget. One app. One price.
          </p>
          <div className="food-landing-feature-grid">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="food-landing-feature-card">
                <div
                  className="food-landing-feature-emoji"
                  style={{ background: `${feature.color}18` }}
                >
                  {feature.emoji}
                </div>
                <h3 className="food-landing-feature-title">{feature.title}</h3>
                <p className="food-landing-feature-desc">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Refugee band ─────────────────────────────────────── */}
      <section className="food-landing-band">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">For Yummly &amp; PlateJoy refugees</h2>
          <p className="food-landing-band-lede">
            Yummly shut down in December 2024. PlateJoy shut down in July 2025.
            Millions of families lost years of saved recipes. If that was you —
            <strong> bring your export. </strong>
            We&apos;ll clean it up, fill in the missing metadata, and drop every
            recipe straight into your new library on day one.
          </p>
          <div className="food-landing-band-steps">
            <div className="food-landing-band-step">
              <span className="food-landing-band-step-num">1</span>
              <span>Upload your Yummly or PlateJoy export .zip</span>
            </div>
            <div className="food-landing-band-step">
              <span className="food-landing-band-step-num">2</span>
              <span>AI cleans up missing ingredients, steps, cuisine tags</span>
            </div>
            <div className="food-landing-band-step">
              <span className="food-landing-band-step-num">3</span>
              <span>Generate your first non-repeating week from them</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────── */}
      <section id="pricing" className="food-landing-section">
        <div className="food-landing-section-inner">
          <h2 className="food-landing-h2">One price. No tiers.</h2>
          <p className="food-landing-h2-sub">
            Try it free for a week. Pay once a year.
          </p>
          <div className="food-landing-pricing">
            <div className="food-landing-price-card">
              <div className="food-landing-price-label">Annual</div>
              <div className="food-landing-price-amount">
                <span className="food-landing-price-currency">$</span>
                <span className="food-landing-price-number">39</span>
                <span className="food-landing-price-period">/year</span>
              </div>
              <div className="food-landing-price-effective">
                Effective $3.25/month — undercutting every other planner on the
                market.
              </div>
              <ul className="food-landing-price-list">
                <li>✅ Unlimited AI meal plans (non-repeating)</li>
                <li>✅ Unlimited AI recipe generation</li>
                <li>✅ Receipt scanning &amp; pantry tracking</li>
                <li>✅ Multi-person family profiles</li>
                <li>✅ Walmart / Kroger curbside formatter</li>
                <li>✅ Yummly / PlateJoy import</li>
                <li>✅ One-click data export, anytime</li>
              </ul>
              <Link
                href="/signup?callbackUrl=/food/billing&plan=food"
                className="food-btn food-btn-primary food-glow food-landing-price-cta"
              >
                Start 30-day free trial →
              </Link>
              <p className="food-landing-price-micro">
                Credit card required · cancel in one click · reminder email 2
                days before trial ends
              </p>
            </div>
          </div>
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
          <h2 className="food-landing-h2">Your kitchen is worth 11 cents a day.</h2>
          <p className="food-landing-h2-sub">
            Less than a gallon of milk per year. More peace of mind than any
            app in the category.
          </p>
          <Link
            href="/signup?callbackUrl=/food/billing&plan=food"
            className="food-btn food-btn-primary food-glow food-landing-cta-primary"
          >
            Start 30-day free trial
          </Link>
        </div>
      </section>
    </div>
  );
}
