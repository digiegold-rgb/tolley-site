import Link from "next/link";

export const metadata = {
  title: "Drive with Red Alert Dispatch | Earn 82% of Every Delivery",
  description:
    "KC delivery drivers: keep 82% of what clients pay. No signup fees. Same deliveries, way better pay.",
};

export default function DriverRecruitPage() {
  return (
    <main className="relative z-10 min-h-screen">
      {/* Hero */}
      <section className="px-5 pt-16 pb-12 text-center">
        <h1 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tight lm-neon-text">
          Drive. Earn More.
        </h1>
        <p className="mt-4 text-xl text-gray-300 max-w-2xl mx-auto">
          Gig apps take 60%. We take 18%. You keep{" "}
          <span className="text-green-400 font-bold">82%</span> of every
          delivery.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/drive/register"
            className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-lg lm-glow transition-colors"
          >
            Apply Now — Free
          </Link>
          <Link
            href="/drive/quote"
            className="px-8 py-4 border border-gray-600 hover:border-gray-400 text-gray-300 font-semibold rounded-lg transition-colors"
          >
            See Pay Rates
          </Link>
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-4xl px-5 py-12">
        <h2 className="text-3xl font-bold text-white text-center mb-8">
          The Math Doesn&apos;t Lie
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Gig apps */}
          <div className="p-6 bg-gray-900/60 border border-gray-700 rounded-xl">
            <h3 className="text-lg font-semibold text-gray-400">
              Typical Gig App
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Client pays</span>
                <span className="text-white font-semibold">$50.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Platform takes (60%)</span>
                <span className="text-red-400 font-semibold">-$30.00</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-3">
                <span className="text-gray-300 font-bold">You earn</span>
                <span className="text-red-400 font-bold text-xl">$20.00</span>
              </div>
            </div>
          </div>

          {/* Red Alert */}
          <div className="p-6 bg-gradient-to-br from-red-900/30 to-gray-900/60 border border-red-700/50 rounded-xl">
            <h3 className="text-lg font-semibold text-red-400">
              Red Alert Dispatch
            </h3>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-300">Client pays</span>
                <span className="text-white font-semibold">$31.25</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Platform takes (18%)</span>
                <span className="text-gray-400 font-semibold">-$5.63</span>
              </div>
              <div className="flex justify-between border-t border-red-700/30 pt-3">
                <span className="text-white font-bold">You earn</span>
                <span className="text-green-400 font-bold text-xl">
                  $25.63
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-gray-400">
          Same delivery. Client saves $18.75. You earn $5.63 more. Everyone
          wins.
        </p>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-4xl px-5 py-12">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              title: "No Signup Fee",
              desc: "GoShare charges $49. We charge $0.",
            },
            {
              title: "Instant Pay",
              desc: "Cash out your earnings anytime via Stripe.",
            },
            {
              title: "Your Schedule",
              desc: "Go online when you want. No minimums.",
            },
            {
              title: "SMS Dispatch",
              desc: "Get orders via text. Reply YES to accept.",
            },
            {
              title: "KC Metro Only",
              desc: "Local deliveries, local drivers, local support.",
            },
            {
              title: "AI Matching",
              desc: "We send you orders closest to your location.",
            },
          ].map((b) => (
            <div
              key={b.title}
              className="p-5 bg-gray-900/60 border border-gray-700 rounded-xl lm-card"
            >
              <h3 className="text-lg font-bold text-white">{b.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16 text-center">
        <h2 className="text-3xl font-bold text-white">
          Ready to earn what you deserve?
        </h2>
        <Link
          href="/drive/register"
          className="inline-block mt-6 px-10 py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-lg lm-glow transition-colors"
        >
          Start Driving Today
        </Link>
      </section>
    </main>
  );
}
