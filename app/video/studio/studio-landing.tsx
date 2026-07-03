"use client";

import Link from "next/link";
import { useRef, useEffect, useCallback } from "react";

/* ── Data ── */
const IMAGE_MODELS = [
  { name: "FLUX.1 Schnell", speed: "~10 s", quality: "6-7/10", tier: "draft", desc: "Fast previews, social media", color: "#f59e0b" },
  { name: "FLUX.2 Klein 4B", speed: "~15 s", quality: "7/10", tier: "quality", desc: "Quality fast images", color: "#a855f7" },
  { name: "FLUX.2 Dev 32B", speed: "~90 s", quality: "9-10/10", tier: "best", desc: "Best photorealism, 4MP", color: "#22c55e" },
];

const VIDEO_MODELS = [
  { name: "Wan 2.1 Draft", speed: "~30 s", quality: "6-7/10", tier: "draft", desc: "Quick motion tests", color: "#f59e0b" },
  { name: "LTX-2.3 22B", speed: "~60 s", quality: "8/10", tier: "quality", desc: "Video + audio generation", color: "#a855f7" },
  { name: "HunyuanVideo 13B", speed: "~2 min", quality: "8-9/10", tier: "quality", desc: "Cinematic motion, physics", color: "#a855f7" },
  { name: "Wan 2.2 14B", speed: "~4 min", quality: "9-10/10", tier: "best", desc: "Cinema-grade, FramePack 60s", color: "#22c55e" },
];

const PRICING = [
  { name: "Starter", credits: 5, price: "$25", per: "$5.00/credit", examples: "5 photos or 1 video", highlight: false },
  { name: "Producer", credits: 20, price: "$80", per: "$4.00/credit", examples: "20 photos or 6 videos", highlight: true },
  { name: "Studio", credits: 50, price: "$175", per: "$3.50/credit", examples: "50 photos or 16 videos", highlight: false },
];

const CREDIT_COSTS = [
  { item: "FLUX.1 Schnell image (fast preview)", cost: 1 },
  { item: "FLUX.2 Klein 4B image (quality fast)", cost: 1 },
  { item: "FLUX.2 Dev 32B image (photorealistic)", cost: 3 },
  { item: "Wan 2.1 Draft video", cost: 3 },
  { item: "LTX-2.3 video + audio", cost: 5 },
  { item: "HunyuanVideo 13B video", cost: 6 },
  { item: "Wan 2.2 14B video (cinema-grade)", cost: 8 },
];

const SHOWREEL = [
  { label: "Real Estate", cost: "2 credits", img: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80" },
  { label: "Product Photos", cost: "1 credit", img: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80" },
  { label: "Portraits", cost: "2 credits", img: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80" },
  { label: "Food & Drink", cost: "1 credit", img: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80" },
  { label: "Landscapes", cost: "2 credits", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80" },
  { label: "Abstract & AI Art", cost: "3 credits", img: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600&q=80" },
];

const PILLARS = [
  {
    title: "Better",
    color: "#a855f7",
    icon: "\u2728",
    us: ["Dedicated NVIDIA Blackwell GPU", "3 image + 4 video models", "AI quality review built-in"],
    them: ["Shared cloud instances", "1-2 models, usually locked", "No quality feedback"],
  },
  {
    title: "Faster",
    color: "#06b6d4",
    icon: "\u26A1",
    us: ["Instant start, no queue", "Draft mode in ~5 seconds", "Your job runs immediately"],
    them: ["5-15 min cloud queues", "No quick preview option", "Waiting behind thousands"],
  },
  {
    title: "Cheaper",
    color: "#22c55e",
    icon: "\uD83D\uDCB0",
    us: ["Flat credits from $3.50 each", "No monthly minimums", "Pay only for what you use"],
    them: ["$0.10-0.50 per second billing", "Forced monthly subscriptions", "Surprise overages"],
  },
  {
    title: "Safer",
    color: "#f59e0b",
    icon: "\uD83D\uDD12",
    us: ["Private dedicated hardware", "Your data stays yours", "No content used for training"],
    them: ["Shared infrastructure", "Content may train their models", "Data retention policies unclear"],
  },
];

const HERO_VIDEO = "https://assets.mixkit.co/active_storage/video_items/99833/1717026087/99833-video-1080.mp4";
const FINALE_VIDEO = "https://assets.mixkit.co/active_storage/video_items/99823/1717007007/99823-video-1080.mp4";

/* ── Component ── */
export function StudioLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const revealRefs = useRef<Set<HTMLElement>>(new Set());

  /* Mouse tracking — sets --sl-mx / --sl-my (0-1) on root */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    root.style.setProperty("--sl-mx", String(Math.max(0, Math.min(1, mx))));
    root.style.setProperty("--sl-my", String(Math.max(0, Math.min(1, my))));
  }, []);

  /* Scroll reveal via IntersectionObserver */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.addEventListener("mousemove", handleMouseMove);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("sl-visible");
          }
        });
      },
      { threshold: 0.12 }
    );

    const els = root.querySelectorAll<HTMLElement>(".sl-reveal");
    els.forEach((el) => observer.observe(el));

    return () => {
      root.removeEventListener("mousemove", handleMouseMove);
      observer.disconnect();
    };
  }, [handleMouseMove]);

  /* Per-card mouse glow */
  const onCardMouse = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
  }, []);

  return (
    <div ref={rootRef} className="sl-root studio-landing-page">
      {/* ━━━ HERO ━━━ */}
      <section className="sl-hero">
        <video
          className="sl-hero-video"
          src={HERO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="sl-hero-overlay" />
        <div className="sl-glow-follow" />
        <div className="sl-parallax-orb sl-orb-1" />
        <div className="sl-parallax-orb sl-orb-2" />

        <div className="sl-hero-inner">
          <div className="sl-eyebrow hp-fade-up">
            <span className="sl-eyebrow-dot" />
            AI Creator Studio
          </div>

          <h1 className="sl-h1 hp-fade-up hp-fade-up-d1">
            Create stunning visuals
            <br />
            <span className="hp-gradient-text">on dedicated GPU power.</span>
          </h1>

          <p className="sl-subtitle hp-fade-up hp-fade-up-d2">
            3 image models. 4 video models. AI quality review. Powered by NVIDIA
            Blackwell hardware — no cloud queues, no shared GPUs, no billing
            surprises.
          </p>

          <div className="sl-ctas hp-fade-up hp-fade-up-d3">
            <Link
              href="/signup?callbackUrl=/video/studio"
              className="sl-btn sl-btn-primary vid-cta-glow"
            >
              Start Creating
            </Link>
            <Link
              href="/login?callbackUrl=/video/studio"
              className="sl-btn sl-btn-ghost"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="sl-scroll-hint hp-fade-up hp-fade-up-d4">
          <span>Scroll</span>
          <div className="sl-scroll-arrow" />
        </div>
      </section>

      {/* ━━━ SHOWREEL ━━━ */}
      <section className="sl-section sl-reveal">
        <h2 className="sl-h2">What You Can Create</h2>
        <p className="sl-section-sub">
          From product shots to cinematic video — generate anything you can
          describe.
        </p>
        <div className="sl-showreel-grid">
          {SHOWREEL.map((item) => (
            <div
              key={item.label}
              className="sl-showreel-card"
              onMouseMove={onCardMouse}
            >
              <img
                src={item.img}
                alt={item.label}
                loading="lazy"
                width={600}
                height={450}
              />
              <div className="sl-showreel-overlay">
                <span className="sl-showreel-label">{item.label}</span>
                <span className="sl-showreel-cost">{item.cost}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ COMPARISON ━━━ */}
      <section className="sl-section sl-reveal">
        <h2 className="sl-h2">
          Us vs <span className="hp-gradient-text">Everyone Else</span>
        </h2>
        <p className="sl-section-sub">
          Not all AI generation is equal. Here&apos;s why creators choose
          Creator Studio.
        </p>
        <div className="sl-comparison-grid">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="sl-comparison-card"
              style={{ "--pillar-color": p.color } as React.CSSProperties}
              onMouseMove={onCardMouse}
            >
              <div className="sl-pillar-icon">{p.icon}</div>
              <div className="sl-pillar-title">{p.title}</div>
              <div className="sl-vs-row">
                <div>
                  <div className="sl-vs-header sl-vs-header-us">
                    Creator Studio
                  </div>
                  {p.us.map((line) => (
                    <div key={line} className="sl-vs-us">
                      {line}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="sl-vs-header sl-vs-header-them">Others</div>
                  {p.them.map((line) => (
                    <div key={line} className="sl-vs-them">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ HOW IT WORKS ━━━ */}
      <section className="sl-section sl-reveal">
        <h2 className="sl-h2">How It Works</h2>
        <p className="sl-section-sub">Three steps. Under a minute.</p>
        <div className="sl-steps-track sl-reveal">
          <div className="sl-step-connector" />
          <div
            className="sl-step-card video-enter"
            style={{ "--enter-delay": "0s" } as React.CSSProperties}
          >
            <div className="sl-step-num">1</div>
            <h3>Describe</h3>
            <p>
              Type what you want or use the prompt builder. Pick a model for your
              quality needs.
            </p>
          </div>
          <div
            className="sl-step-card video-enter"
            style={{ "--enter-delay": "0.15s" } as React.CSSProperties}
          >
            <div className="sl-step-num">2</div>
            <h3>Generate</h3>
            <p>
              Your prompt runs on dedicated NVIDIA Blackwell hardware. No cloud
              queue — starts immediately.
            </p>
          </div>
          <div
            className="sl-step-card video-enter"
            style={{ "--enter-delay": "0.3s" } as React.CSSProperties}
          >
            <div className="sl-step-num">3</div>
            <h3>Download</h3>
            <p>
              Preview your result, get AI quality feedback, and download. Your
              generations are private.
            </p>
          </div>
        </div>
      </section>

      {/* ━━━ MODELS & PRICING ━━━ */}
      <section className="sl-section sl-reveal">
        <h2 className="sl-h2">Models & Pricing</h2>
        <p className="sl-section-sub">
          Buy credits, use them on any model. No subscriptions required.
        </p>

        {/* Image models */}
        <div className="sl-models-section-title">Image Generation</div>
        <div className="sl-models-grid">
          {IMAGE_MODELS.map((m) => (
            <div
              key={m.name}
              className="sl-model-card-v2"
              style={{ "--tier-color": m.color } as React.CSSProperties}
            >
              <div className="sl-model-name">{m.name}</div>
              <div className="sl-model-meta">
                <span className="sl-model-speed">{m.speed}</span>
                <span className="sl-model-quality">{m.quality}</span>
              </div>
              <div className="sl-model-desc">{m.desc}</div>
            </div>
          ))}
        </div>

        {/* Video models */}
        <div className="sl-models-section-title">Video Generation</div>
        <div className="sl-models-grid">
          {VIDEO_MODELS.map((m) => (
            <div
              key={m.name}
              className="sl-model-card-v2"
              style={{ "--tier-color": m.color } as React.CSSProperties}
            >
              <div className="sl-model-name">{m.name}</div>
              <div className="sl-model-meta">
                <span className="sl-model-speed">{m.speed}</span>
                <span className="sl-model-quality">{m.quality}</span>
              </div>
              <div className="sl-model-desc">{m.desc}</div>
            </div>
          ))}
        </div>

        {/* Pricing cards */}
        <div className="sl-pricing-grid">
          {PRICING.map((p) => (
            <div
              key={p.name}
              className={`sl-price-card-v2 ${p.highlight ? "sl-price-featured hp-shimmer-border" : ""}`}
            >
              {p.highlight && (
                <span className="sl-popular-badge vid-badge-shimmer">
                  Most Popular
                </span>
              )}
              <div className="sl-price-name">{p.name}</div>
              <div className="sl-price-amount">{p.price}</div>
              <div className="sl-price-credits">{p.credits} credits</div>
              <div className="sl-price-per">{p.per}</div>
              <div className="sl-price-example">{p.examples}</div>
              <Link
                href="/signup?callbackUrl=/video/studio"
                className="sl-btn sl-btn-primary sl-btn-full"
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>

        {/* Credit cost table */}
        <div className="sl-cost-table">
          <h3>What Credits Get You</h3>
          <table>
            <tbody>
              {CREDIT_COSTS.map((c) => (
                <tr key={c.item}>
                  <td>{c.item}</td>
                  <td className="sl-cost-val">
                    {c.cost} credit{c.cost > 1 ? "s" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ━━━ FINAL CTA ━━━ */}
      <section className="sl-finale sl-reveal">
        <video
          className="sl-finale-video"
          src={FINALE_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
        <div className="sl-finale-overlay" />
        <div className="sl-glow-follow" />
        <div className="sl-finale-inner">
          <h2 className="sl-h2 vid-neon-text">Start creating today.</h2>
          <p className="sl-section-sub">
            Sign up and generate your first image in under a minute.
          </p>
          <Link
            href="/signup?callbackUrl=/video/studio"
            className="sl-btn sl-btn-primary sl-btn-lg vid-cta-glow"
          >
            Create Free Account
          </Link>
          <p className="sl-trust-line">
            No credit card required &middot; Private hardware &middot; Your
            content, your data
          </p>
        </div>
      </section>

      {/* ━━━ FOOTER ━━━ */}
      <footer className="sl-mini-footer">
        <p>
          Powered by NVIDIA Blackwell GB10 &middot; Built by{" "}
          <Link href="/">Tolley.io</Link>
        </p>
        <div className="sl-footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
