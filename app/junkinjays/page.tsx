import { JJ_SERVICES, JJ_METALS, JJ_WHY, JJ_FAQ, JJ_PHONE, JJ_PHONE_TEL, JJ_AREA } from "@/lib/junkinjays";
import { JjPageClient } from "@/components/junkinjays/jj-page-client";

export default function JunkinjaysPage() {
  return (
    <JjPageClient>
      <main className="relative z-10 min-h-screen">
        {/* Sticky phone strip */}
        <div className="jj-phone-strip sticky top-0 z-50 flex items-center justify-center gap-3 px-4 py-2.5 text-center">
          <span className="text-sm font-bold text-white tracking-wide">FREE QUOTES</span>
          <span className="text-white/40">|</span>
          <a
            href={JJ_PHONE_TEL}
            data-phone-click
            className="text-sm font-bold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white"
          >
            {JJ_PHONE}
          </a>
          <span className="text-white/40">|</span>
          <span className="text-xs text-white/70">Call or Text</span>
        </div>

        {/* Hero */}
        <section className="jj-hero-bg relative overflow-hidden px-5 pt-16 pb-20 text-center sm:pt-24 sm:pb-28">
          <div className="mx-auto max-w-3xl">
            <h1
              className="jj-neon-text text-5xl font-bold tracking-tight sm:text-7xl"
              style={{ fontFamily: "var(--font-russo), sans-serif", color: "#e85d04" }}
            >
              JUNKIN&apos; JAY&apos;S
            </h1>
            <p className="mt-4 text-xl text-white/70 sm:text-2xl">
              Scrap Metal Pickup &amp; Junk Hauling
            </p>
            <p className="mt-2 text-sm text-[#3b82f6]/70">{JJ_AREA}</p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={JJ_PHONE_TEL}
                data-phone-click
                className="jj-glow rounded-xl bg-[#e85d04] px-8 py-4 text-lg font-bold text-white shadow-lg hover:bg-[#d35400] transition-colors"
              >
                Call Jay: {JJ_PHONE}
              </a>
              <a
                href={`sms:+18162062897`}
                className="jj-wiggle rounded-xl border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-8 py-4 text-lg font-bold text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors"
              >
                Text Jay
              </a>
            </div>

            <p className="mt-6 text-sm text-white/50 max-w-md mx-auto">
              Got scrap metal sitting around? Old appliances? A dead lawn mower? <br />
              <span className="text-[#e85d04] font-semibold">Call or text for a free quote — prices vary by job.</span>
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-12 px-5 pb-20 sm:px-8">
          {/* What We Take */}
          <div className="jj-enter jj-section-metals" style={{ "--enter-delay": "0.1s" } as React.CSSProperties}>
            <h2 className="text-2xl font-bold text-[#3b82f6] mb-6 text-center" style={{ fontFamily: "var(--font-russo)" }}>
              WHAT WE TAKE
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {JJ_METALS.map((metal) => (
                <div
                  key={metal.name}
                  className="jj-metal-tag rounded-xl px-4 py-4 text-center"
                >
                  <div className="text-2xl mb-1">{metal.emoji}</div>
                  <div className="text-lg font-bold text-[#e85d04]">{metal.name}</div>
                  <div className="text-[0.65rem] text-white/40 mt-1">{metal.note}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Services */}
          <div className="jj-enter jj-section-services" style={{ "--enter-delay": "0.2s" } as React.CSSProperties}>
            <h2 className="text-2xl font-bold text-[#e85d04] mb-6 text-center" style={{ fontFamily: "var(--font-russo)" }}>
              OUR SERVICES
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {JJ_SERVICES.map((svc) => (
                <div
                  key={svc.title}
                  className="jj-card rounded-xl bg-white/[0.03] border border-white/10 p-6"
                >
                  <h3 className="text-lg font-bold text-white mb-2">
                    <span className="mr-2">{svc.emoji}</span>
                    {svc.title}
                  </h3>
                  <p className="text-sm text-white/50 mb-3">{svc.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {svc.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-[#e85d04]/10 border border-[#e85d04]/20 px-2.5 py-0.5 text-xs text-[#e85d04]/80"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why Jay */}
          <div className="jj-enter jj-section-why" style={{ "--enter-delay": "0.3s" } as React.CSSProperties}>
            <h2 className="text-2xl font-bold text-[#3b82f6] mb-6 text-center" style={{ fontFamily: "var(--font-russo)" }}>
              WHY CALL JAY?
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {JJ_WHY.map((item) => (
                <div
                  key={item.title}
                  className="jj-card jj-card-blue rounded-xl bg-[#3b82f6]/[0.04] border border-[#3b82f6]/15 p-5 text-center"
                >
                  <div className="text-3xl mb-2">{item.emoji}</div>
                  <h3 className="text-sm font-bold text-white mb-1">{item.title}</h3>
                  <p className="text-xs text-white/40">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Big CTA */}
          <div className="jj-enter" style={{ "--enter-delay": "0.4s" } as React.CSSProperties}>
            <div className="jj-cta-bg jj-neon-border rounded-2xl p-8 sm:p-12 text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl" style={{ fontFamily: "var(--font-russo)" }}>
                GOT SCRAP?
              </h2>
              <p className="mt-3 text-lg text-white/60 max-w-lg mx-auto">
                Don&apos;t let that junk sit there. One call and we&apos;ll quote it.
                Appliances, metal, batteries, junk removal — <span className="text-[#e85d04] font-semibold">prices vary by job</span>.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                <a
                  href={JJ_PHONE_TEL}
                  data-phone-click
                  className="jj-glow rounded-xl bg-[#e85d04] px-10 py-5 text-xl font-bold text-white shadow-lg hover:bg-[#d35400] transition-colors"
                >
                  GET A FREE QUOTE
                </a>
                <a
                  href="sms:+18162062897"
                  className="jj-wiggle rounded-xl border-2 border-[#3b82f6]/50 bg-[#3b82f6]/10 px-10 py-5 text-xl font-bold text-[#3b82f6] hover:bg-[#3b82f6]/20 transition-colors"
                >
                  TEXT JAY
                </a>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="jj-enter jj-section-faq" style={{ "--enter-delay": "0.5s" } as React.CSSProperties}>
            <h2 className="text-2xl font-bold text-[#e85d04] mb-6 text-center" style={{ fontFamily: "var(--font-russo)" }}>
              QUESTIONS?
            </h2>
            <div className="space-y-3 max-w-2xl mx-auto">
              {JJ_FAQ.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden"
                >
                  <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-white/80 flex items-center justify-between hover:text-white transition-colors">
                    {faq.q}
                    <span className="text-[#3b82f6] text-xl group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <div className="px-5 pb-4 text-sm text-white/50">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>

          {/* Service Area */}
          <div className="jj-enter" style={{ "--enter-delay": "0.6s" } as React.CSSProperties}>
            <div className="jj-section-area rounded-xl p-6 text-center">
              <h2 className="text-lg font-bold text-[#3b82f6] mb-3" style={{ fontFamily: "var(--font-russo)" }}>
                SERVICE AREA
              </h2>
              <p className="text-sm text-white/50 max-w-lg mx-auto">
                Independence, Blue Springs, Lee&apos;s Summit, Raytown, Grandview, Belton,
                Grain Valley, Oak Grove, Sugar Creek, Kansas City MO &amp; KS — and surrounding areas.
              </p>
              <p className="mt-2 text-xs text-white/30">
                Not sure if we cover your area? Call and ask — we go far for good loads.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/5 px-5 py-8 text-center">
          <p className="text-sm text-white/30">
            &copy; {new Date().getFullYear()} Junkin&apos; Jay&apos;s &middot; {JJ_AREA}
          </p>
          <p className="mt-1 text-xs text-white/20">
            Part of{" "}
            <a href="https://www.tolley.io/start" className="text-[#3b82f6]/40 hover:text-[#3b82f6]/70">
              tolley.io
            </a>
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-white/20">
            <a href="/trailer" className="hover:text-white/40">Trailers</a>
            <a href="/wd" className="hover:text-white/40">W/D Rental</a>
            <a href="/generator" className="hover:text-white/40">Generator</a>
            <a href="/homes" className="hover:text-white/40">Real Estate</a>
            <a href="/hvac" className="hover:text-white/40">HVAC</a>
            <a href="/lastmile" className="hover:text-white/40">Delivery</a>
            <a href="/moving" className="hover:text-white/40">Moving</a>
            <a href="/shop" className="hover:text-white/40">Shop</a>
          </div>
        </footer>
      </main>
    </JjPageClient>
  );
}
