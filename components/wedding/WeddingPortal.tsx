"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import Image from "next/image";
import type { WeddingPhoto } from "./data/photos";

/* ─── Mouse + viewport hooks ──────────────────────── */
const MouseCtx = createContext({ x: 0, y: 0 });

function MouseProvider({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  return <MouseCtx.Provider value={pos}>{children}</MouseCtx.Provider>;
}

function useInView<T extends HTMLElement = HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

function useScrollY() {
  const [y, setY] = useState(0);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return y;
}

/* ─── Cursor glow ─────────────────────────────────── */
function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const mouse = useContext(MouseCtx);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.left = mouse.x + "px";
      ref.current.style.top = mouse.y + "px";
    }
  }, [mouse]);
  return <div ref={ref} className="et-cursor-glow" />;
}

/* ─── Particle field (soft pollen/dust) ───────────── */
function PollenField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    type Mote = { x: number; y: number; r: number; vy: number; vx: number; hue: number; alpha: number };
    let motes: Mote[] = [];

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(70, Math.floor((w * h) / 32000));
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.7 + Math.random() * 1.6,
        vy: -0.05 - Math.random() * 0.12,
        vx: (Math.random() - 0.5) * 0.12,
        hue: Math.random() < 0.5 ? 1 : 0,
        alpha: 0.25 + Math.random() * 0.4,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y += m.vy;
        m.x += m.vx;
        if (m.y < -10) { m.y = h + 10; m.x = Math.random() * w; }
        if (m.x < -10) m.x = w + 10;
        if (m.x > w + 10) m.x = -10;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = m.hue
          ? `rgba(183, 146, 104, ${m.alpha})`
          : `rgba(143, 166, 138, ${m.alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="et-particle-canvas" />;
}

/* ─── Kinetic text (char-stagger reveal) ──────────── */
function KineticText({
  text,
  className = "",
  delay = 0,
  tag = "span",
  charDelay = 38,
  italicWords,
  ariaLabel,
}: {
  text: string;
  className?: string;
  delay?: number;
  tag?: ElementType;
  charDelay?: number;
  italicWords?: string[];
  ariaLabel?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>(0.15);
  const italics = new Set(italicWords ?? []);
  let charIdx = 0;
  const inner = text.split(" ").map((word, wi, arr) => {
    const italicize = italics.has(word);
    const wordEl = (
      <span
        key={wi}
        style={{ display: "inline-block", whiteSpace: "pre", fontStyle: italicize ? "italic" : "inherit", color: italicize ? "var(--et-sage-deep)" : "inherit" }}
      >
        {word.split("").map((ch, ci) => {
          const i = charIdx++;
          return (
            <span
              key={ci}
              aria-hidden="true"
              style={{
                display: "inline-block",
                opacity: inView ? 1 : 0,
                transform: inView
                  ? "translateY(0) rotateX(0)"
                  : "translateY(40px) rotateX(-70deg)",
                transition: `opacity 0.9s var(--et-ease) ${delay + i * charDelay}ms, transform 1s var(--et-ease) ${delay + i * charDelay}ms`,
              }}
            >
              {ch}
            </span>
          );
        })}
        {wi < arr.length - 1 ? (() => { charIdx++; return <span key={`s${wi}`} aria-hidden="true">&nbsp;</span>; })() : null}
      </span>
    );
    return wordEl;
  });
  return createElement(
    tag,
    { ref, className, style: { display: "block" }, "aria-label": ariaLabel ?? text },
    inner,
  );
}

/* ─── Reveal & StaggerIn ──────────────────────────── */
function Reveal({
  children,
  delay = 0,
  direction = "up",
  className = "",
  style = {},
}: {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
  className?: string;
  style?: CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);
  const dirs: Record<string, string> = {
    up: "translateY(48px)",
    down: "translateY(-48px)",
    left: "translateX(48px)",
    right: "translateX(-48px)",
    scale: "scale(0.94)",
  };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : dirs[direction],
        transition: `opacity 1.1s var(--et-ease) ${delay}ms, transform 1.2s var(--et-ease) ${delay}ms`,
        willChange: "transform, opacity",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StaggerIn({
  children,
  delay = 90,
  initialDelay = 0,
  className = "",
  style = {},
}: {
  children: ReactNode[];
  delay?: number;
  initialDelay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);
  return (
    <div ref={ref} className={className} style={style}>
      {children.map((child, i) => (
        <div
          key={i}
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(36px)",
            transition: `opacity 1s var(--et-ease) ${initialDelay + i * delay}ms, transform 1.1s var(--et-ease) ${initialDelay + i * delay}ms`,
            willChange: "transform, opacity",
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/* ─── Monogram (animated SVG E & T) ───────────────── */
function Monogram({ small = false }: { small?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 120);
    return () => window.clearTimeout(id);
  }, []);
  const stroke = small ? 1.5 : 2;
  // Three glyph paths drawn with stroke-dasharray + animated dashoffset.
  // Lengths are rough; the dashoffset is set generously so the draw plays.
  return (
    <svg
      viewBox="0 0 420 200"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="13:13 Weddings &amp; Events monogram"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="etBrass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c9a57a" />
          <stop offset="55%" stopColor="#b79268" />
          <stop offset="100%" stopColor="#8a6b48" />
        </linearGradient>
      </defs>
      {/* "13" left */}
      <g
        fill="none"
        stroke="url(#etBrass)"
        strokeWidth={stroke + 0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 600,
          strokeDashoffset: mounted ? 0 : 600,
          transition: "stroke-dashoffset 1.6s var(--et-ease)",
        }}
      >
        {/* 1 */}
        <path d="M50 50 L66 44 L66 156" />
        {/* 3 */}
        <path d="M92 56 Q124 38 142 60 Q148 78 122 92 Q150 96 152 122 Q150 154 110 154 Q92 154 84 142" />
      </g>
      {/* Center : */}
      <g
        fill="url(#etBrass)"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.8s var(--et-ease) 600ms, transform 0.8s var(--et-ease) 600ms",
          transformOrigin: "center",
        }}
      >
        <circle cx="210" cy="80" r="5" />
        <circle cx="210" cy="120" r="5" />
      </g>
      {/* "13" right */}
      <g
        fill="none"
        stroke="url(#etBrass)"
        strokeWidth={stroke + 0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 600,
          strokeDashoffset: mounted ? 0 : 600,
          transition: "stroke-dashoffset 1.6s var(--et-ease) 360ms",
        }}
      >
        <path d="M250 50 L266 44 L266 156" />
        <path d="M292 56 Q324 38 342 60 Q348 78 322 92 Q350 96 352 122 Q350 154 310 154 Q292 154 284 142" />
      </g>
      {/* Floral sprig */}
      <g
        fill="none"
        stroke="#5f7a60"
        strokeWidth={stroke - 0.4}
        strokeLinecap="round"
        style={{
          strokeDasharray: 400,
          strokeDashoffset: mounted ? 0 : 400,
          transition: "stroke-dashoffset 1.8s var(--et-ease) 800ms",
        }}
      >
        <path d="M170 178 Q210 168 250 178" />
        <path d="M180 178 Q176 168 168 164" />
        <path d="M196 178 Q194 168 188 162" />
        <path d="M210 178 Q210 166 206 158" />
        <path d="M224 178 Q226 168 232 162" />
        <path d="M240 178 Q244 168 252 164" />
      </g>
    </svg>
  );
}

/* ─── Botanical sprig (drifting) ──────────────────── */
function BotanicalSprig({
  position,
  rotate = 0,
  scale = 1,
  driftDelay = 0,
}: {
  position: CSSProperties;
  rotate?: number;
  scale?: number;
  driftDelay?: number;
}) {
  return (
    <svg
      viewBox="0 0 120 240"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="et-botanical"
      style={{
        ...position,
        width: `${88 * scale}px`,
        height: `${176 * scale}px`,
        animationDelay: `${driftDelay}s`,
        ["--rot" as string]: `${rotate}deg`,
      } as CSSProperties}
    >
      <g
        fill="none"
        stroke="#5f7a60"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M60 230 Q58 130 60 30" />
        {/* leaves left */}
        <path d="M60 200 Q40 196 28 180 Q44 188 60 188 Z" fill="rgba(143,166,138,0.32)" />
        <path d="M60 170 Q40 166 28 150 Q44 158 60 158 Z" fill="rgba(143,166,138,0.32)" />
        <path d="M60 140 Q40 136 28 120 Q44 128 60 128 Z" fill="rgba(143,166,138,0.32)" />
        <path d="M60 108 Q42 104 30 92 Q46 96 60 96 Z" fill="rgba(143,166,138,0.32)" />
        <path d="M60 76 Q44 72 36 62 Q48 66 60 66 Z" fill="rgba(143,166,138,0.32)" />
        {/* leaves right */}
        <path d="M60 215 Q80 212 92 196 Q76 202 60 202 Z" fill="rgba(143,166,138,0.26)" />
        <path d="M60 184 Q80 180 92 164 Q76 172 60 172 Z" fill="rgba(143,166,138,0.26)" />
        <path d="M60 154 Q80 150 94 134 Q78 142 60 142 Z" fill="rgba(143,166,138,0.26)" />
        <path d="M60 122 Q80 118 94 102 Q78 110 60 110 Z" fill="rgba(143,166,138,0.26)" />
        <path d="M60 92 Q78 88 90 76 Q74 82 60 82 Z" fill="rgba(143,166,138,0.26)" />
      </g>
    </svg>
  );
}

/* ─── Parallax wrapper ────────────────────────────── */
function Parallax({ children, speed = 0.18, className }: { children: ReactNode; speed?: number; className?: string }) {
  const y = useScrollY();
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const docTop = rect.top + window.scrollY;
    const center = y + window.innerHeight / 2 - (docTop + rect.height / 2);
    setOffset(center * speed);
  }, [y, speed]);
  return (
    <div ref={ref} className={className} style={{ transform: `translateY(${offset}px)`, willChange: "transform" }}>
      {children}
    </div>
  );
}

/* ─── Inquiry form ────────────────────────────────── */
function InquiryForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const fd = new FormData(e.currentTarget);
    const body = {
      subsite: "e-and-t",
      action: "request_wedding_consult",
      contact: {
        name: String(fd.get("name") || "").trim() || undefined,
        email: String(fd.get("email") || "").trim() || undefined,
        phone: String(fd.get("phone") || "").trim() || undefined,
      },
      fields: {
        package: String(fd.get("package") || "not_sure"),
        wedding_date: String(fd.get("wedding_date") || "").trim() || undefined,
        venue: String(fd.get("venue") || "").trim() || undefined,
        guest_count: String(fd.get("guest_count") || "").trim() || undefined,
        message: String(fd.get("message") || "").trim() || undefined,
      },
    };
    try {
      const res = await fetch("/api/lead/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(json.error || "Something went wrong — please call or text 913-213-3741.");
        return;
      }
      setReceipt(json.receiptToken);
      setStatus("sent");
    } catch {
      setStatus("error");
      setErrorMsg("Network hiccup. Please try again, or text 913-213-3741.");
    }
  }

  if (status === "sent") {
    return (
      <div className="et-form et-form-success">
        <span className="et-script">thank you</span>
        <p>
          Your note is on its way to Emily &amp; Trevor. We&apos;ll be in touch within a day — usually
          much sooner. <br />
          {receipt ? <small style={{ opacity: 0.6 }}>Ref: {receipt}</small> : null}
        </p>
      </div>
    );
  }

  return (
    <form className="et-form" onSubmit={onSubmit}>
      <div className="et-form-row cols-2">
        <div className="et-field">
          <label htmlFor="name">Your names</label>
          <input id="name" name="name" required placeholder="Bride &amp; groom" autoComplete="name" />
        </div>
        <div className="et-field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required placeholder="hello@yourname.com" autoComplete="email" />
        </div>
      </div>
      <div className="et-form-row cols-2">
        <div className="et-field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" placeholder="(816) ..." autoComplete="tel" />
        </div>
        <div className="et-field">
          <label htmlFor="package">What you&apos;re drawn to</label>
          <select id="package" name="package" defaultValue="coordination">
            <option value="coordination">Coordination ($650 / $800)</option>
            <option value="officiant">Officiant ($250+)</option>
            <option value="planning">Full Planning ($1,500)</option>
            <option value="not_sure">Not sure yet — help us decide</option>
          </select>
        </div>
      </div>
      <div className="et-form-row cols-2">
        <div className="et-field">
          <label htmlFor="wedding_date">Date or window</label>
          <input id="wedding_date" name="wedding_date" placeholder="September 21, 2026" />
        </div>
        <div className="et-field">
          <label htmlFor="venue">Venue or city</label>
          <input id="venue" name="venue" placeholder="Lee's Summit, MO" />
        </div>
      </div>
      <div className="et-form-row">
        <div className="et-field">
          <label htmlFor="guest_count">Guest count (rough)</label>
          <input id="guest_count" name="guest_count" placeholder="120" inputMode="numeric" />
        </div>
      </div>
      <div className="et-form-row">
        <div className="et-field">
          <label htmlFor="message">What&apos;s on your heart</label>
          <textarea id="message" name="message" placeholder="Tell us about your day — anything you&apos;re hoping for or worried about." />
        </div>
      </div>
      <div className="et-form-submit">
        <span className="et-form-note">
          {status === "error" ? errorMsg : "We answer within a day — usually within a few hours."}
        </span>
        <button type="submit" className="et-btn" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send our inquiry"}
        </button>
      </div>
    </form>
  );
}

/* ─── Main portal ─────────────────────────────────── */
export default function WeddingPortal({ photos }: { photos: WeddingPhoto[] }) {
  // About-section photo is the portrait of Emily & Trevor at their sweetheart table.
  // Gallery shows everything except that portrait (no duplication).
  const aboutPhoto =
    photos.find((p) => p.id === "emily-trevor-portrait") ?? photos[0];
  const galleryPhotos = photos.filter((p) => p.id !== "emily-trevor-portrait");

  return (
    <MouseProvider>
      <PollenField />
      <CursorGlow />

      {/* Drifting botanicals — absolutely positioned per section */}
      <BotanicalSprig
        position={{ top: "8vh", left: "-30px" }}
        rotate={-14}
        scale={1.2}
        driftDelay={0}
      />
      <BotanicalSprig
        position={{ top: "32vh", right: "-40px" }}
        rotate={172}
        scale={1.1}
        driftDelay={3}
      />

      {/* ─── HERO ─── */}
      <section className="et-hero">
        <div className="et-shell">
          <Reveal direction="scale" delay={120}>
            <span className="et-eyebrow et-hero-eyebrow">faith · hope · love</span>
          </Reveal>
          <div className="et-hero-mark">
            <Monogram />
          </div>
          <KineticText
            tag="h1"
            className="et-hero-title"
            text="Weddings & Events"
            italicWords={["&"]}
            charDelay={42}
            delay={500}
            ariaLabel="13:13 Weddings & Events"
          />
          <Reveal delay={1900}>
            <span className="et-script et-hero-script">a Kansas City love story</span>
          </Reveal>
          <Reveal delay={2200}>
            <p className="et-hero-sub">
              Faith-led wedding coordination, full planning, and officiant services
              with <em>Emily &amp; Trevor Hawk</em>. We&apos;ll carry the timeline so you can be
              fully there — in your dress, in his arms, in the moment.
            </p>
          </Reveal>
          <Reveal delay={2500}>
            <div className="et-hero-cta">
              <a href="#inquiry" className="et-btn">Book a consult</a>
              <a href="#packages" className="et-btn et-btn--ghost">See packages</a>
            </div>
          </Reveal>
          <Reveal delay={2800}>
            <div className="et-promo">
              <strong>13 · for 13</strong>
              <span>Schedule a consultation by June 13 — 13% off your package price.</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section className="et-section" id="about">
        <div className="et-shell">
          <div className="et-section-head">
            <Reveal>
              <span className="et-eyebrow">about us</span>
              <h2>Two people, one calling.</h2>
              <span className="et-hairline" />
            </Reveal>
          </div>
          <div className="et-about">
            <Reveal direction="right" delay={120}>
              <div className="et-about-photo">
                <Image
                  src={`${aboutPhoto.src}-1600.webp`}
                  alt={aboutPhoto.alt}
                  fill
                  sizes="(max-width: 880px) 100vw, 50vw"
                  placeholder="blur"
                  blurDataURL={aboutPhoto.blurDataURL}
                  priority
                />
              </div>
            </Reveal>
            <Reveal direction="left" delay={240} className="et-about-body">
              <span className="et-eyebrow">Lee&apos;s Summit, MO</span>
              <h3 style={{ fontSize: "clamp(2rem, 3.4vw, 2.6rem)", margin: "16px 0 24px" }}>
                Hi — we&apos;re <em style={{ fontStyle: "italic", color: "var(--et-sage-deep)" }}>Emily &amp; Trevor</em>.
              </h3>
              <p>
                A married duo ready to help with every event of your life, big or small.
                We&apos;re local to <strong>Lee&apos;s Summit</strong> and spend most evenings on long
                walks with our dog, <strong>Phoebe</strong>.
              </p>
              <p>
                By day, Emily is a <strong>first-grade teacher</strong> and Trevor is a
                <strong> treasury analyst</strong> (our resident financial expert). Our
                business began with a friend&apos;s wedding in our living room — then another
                friend asked us to coordinate hers — then Trevor officiated my mother&apos;s
                wedding right back in our home.
              </p>
              <p>
                God has had His hand in every part of this journey, and we are so honored
                and blessed to take on yours.
              </p>
              <span className="et-signature" aria-label="Signed: E and T">
                E <span style={{ color: "var(--et-sage-deep)" }}>&amp;</span> T
              </span>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── SCRIPTURE ─── */}
      <section className="et-scripture">
        <div className="et-shell">
          <Reveal direction="up">
            <span className="et-eyebrow">what makes us different</span>
          </Reveal>
          <Reveal direction="up" delay={120}>
            <p className="et-mission">
              There are a lot of wedding coordinators and planners out there, but our
              mission is simple: <strong>Lead by faith, service, and care</strong> for
              every client. We strive for affordability in an extremely competitive
              and costly industry.
            </p>
          </Reveal>
          <Reveal direction="up" delay={240}>
            <p className="et-mission et-mission--soft">
              Our name is <em>Heaven-inspired</em> and carries the meaning of why we do
              what we do.
            </p>
          </Reveal>
          <Reveal direction="up" delay={360}>
            <p className="et-scripture-quote">
              And these three remain: <em className="et-gradient-text" style={{ fontStyle: "italic" }}>faith</em>,
              <em className="et-gradient-text" style={{ fontStyle: "italic" }}> hope</em>, and
              <em className="et-gradient-text" style={{ fontStyle: "italic" }}> love</em>.
              The greatest of these is <em>love</em>.
            </p>
          </Reveal>
          <Reveal direction="up" delay={500}>
            <div className="et-scripture-cite">1 Corinthians 13:13</div>
          </Reveal>
          <Reveal direction="up" delay={640}>
            <div className="et-faith">
              <span>faith.</span>
              <span>hope.</span>
              <span>love.</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── PACKAGES ─── */}
      <section className="et-section" id="packages">
        <div className="et-shell">
          <div className="et-section-head">
            <Reveal>
              <span className="et-eyebrow">our packages</span>
              <h2>Three ways to walk together.</h2>
              <span className="et-hairline" />
              <p>
                Every package includes day-of coordination, pre-event meetings, a custom
                timeline, vendor communication, and a personalized gift set for the
                couple. Add the officiant for a fully Hawk-led ceremony.
              </p>
            </Reveal>
          </div>

          <StaggerIn className="et-packages" delay={120}>
            {[
              <article className="et-card" key="coord">
                <span className="et-card-tag">coordination</span>
                <h3 className="et-card-title">Day-of &amp; Pre-Event</h3>
                <p className="et-card-lead">For couples who&apos;ve done the planning and want a calm captain on the bridge.</p>
                <div className="et-card-price">
                  <strong>$650</strong>
                  <small>Package One · $800 Package Two</small>
                </div>
                <ul>
                  <li>Day-of coordination</li>
                  <li>Pre-event meetings</li>
                  <li>Custom event timeline</li>
                  <li>Vendor communication before the event</li>
                  <li>Personalized gift set for the couple</li>
                </ul>
                <p className="et-card-footnote">
                  *see handout for price breakdown and package details
                </p>
              </article>,
              <article className="et-card et-card--featured" key="planning">
                <span className="et-card-tag">planning + coordination · new</span>
                <h3 className="et-card-title">Full Planning</h3>
                <p className="et-card-lead">
                  Our NEW exclusive planning + coordination package — an affordable option
                  that is not one to miss.
                </p>
                <div className="et-card-price">
                  <strong>$1,500</strong>
                  <small>add-ons available</small>
                </div>
                <ul>
                  <li>Access to unlimited meetings leading up to your big day</li>
                  <li>Personalized monthly checklist</li>
                  <li>Custom wedding-day timeline</li>
                  <li>Point of contact for all vendors</li>
                  <li><strong>Premium exclusive</strong> access to our preferred vendor list</li>
                  <li>Everything in Coordination, included</li>
                </ul>
                <p className="et-card-footnote">
                  *not including additional add-ons
                </p>
              </article>,
              <article className="et-card" key="officiant">
                <span className="et-card-tag">officiant</span>
                <h3 className="et-card-title">A Hawk-led Ceremony</h3>
                <p className="et-card-lead">
                  Need someone to make your union official? Trevor Hawk is a certified
                  officiant who brings customized ceremony outlines and pre-event
                  consultations leading up to the wedding — with a caring, faith-filled
                  presence that makes the most important moment memorable and intentional.
                </p>
                <div className="et-card-price">
                  <strong>$250</strong>
                  <small>starting</small>
                </div>
                <ul>
                  <li>Custom ceremony outlines</li>
                  <li>Pre-event consultations</li>
                  <li>Vow-writing assistance</li>
                  <li>Unity ceremony options</li>
                  <li>Genuine, faith-led presence on your day</li>
                </ul>
              </article>,
            ]}
          </StaggerIn>
        </div>
      </section>

      {/* ─── GALLERY ─── */}
      {galleryPhotos.length > 0 ? (
        <section className="et-section" id="gallery">
          <div className="et-shell">
            <div className="et-section-head">
              <Reveal>
                <span className="et-eyebrow">a little look</span>
                <h2>Moments we&apos;ve been honored to hold.</h2>
                <span className="et-hairline" />
              </Reveal>
            </div>
            <Reveal>
              <div className="et-gallery">
                {galleryPhotos.map((p) => (
                  <figure key={p.id} data-span={p.span ?? 1}>
                    <Image
                      src={`${p.src}-1600.webp`}
                      alt={p.alt}
                      fill
                      sizes="(max-width: 880px) 100vw, 33vw"
                      placeholder="blur"
                      blurDataURL={p.blurDataURL}
                    />
                  </figure>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ─── INQUIRY ─── */}
      <section className="et-section" id="inquiry">
        <div className="et-shell">
          <div className="et-section-head">
            <Reveal>
              <span className="et-eyebrow">say hello</span>
              <h2>Tell us about your day.</h2>
              <span className="et-hairline" />
            </Reveal>
          </div>
          <div className="et-inquiry">
            <Reveal direction="right" className="et-inquiry-aside">
              <span className="et-eyebrow">we answer everything</span>
              <h3 style={{ marginTop: 14 }}>Coffee, calls, or texts — your call.</h3>
              <p>
                We read every inquiry ourselves. Send the form, or skip it entirely and
                reach us however you&apos;re most comfortable.
              </p>
              <ul className="et-contact-list">
                <li>
                  <span className="et-contact-icon" aria-hidden="true">☎</span>
                  <a href="tel:+19132133741">913.213.3741</a>
                </li>
                <li>
                  <span className="et-contact-icon" aria-hidden="true">✉</span>
                  <a href="mailto:1313weddingco@gmail.com">1313weddingco@gmail.com</a>
                </li>
                <li>
                  <span className="et-contact-icon" aria-hidden="true">◎</span>
                  <a href="https://instagram.com/1313weddingco" target="_blank" rel="noopener noreferrer">
                    @1313weddingco
                  </a>
                  <span className="et-contact-tag">Instagram</span>
                </li>
                <li>
                  <span className="et-contact-icon" aria-hidden="true">f</span>
                  <a href="https://www.facebook.com/1313weddingco" target="_blank" rel="noopener noreferrer">
                    13:13 Weddings &amp; Events
                  </a>
                  <span className="et-contact-tag">Facebook</span>
                </li>
                <li>
                  <span className="et-contact-icon" aria-hidden="true">⌂</span>
                  <span>Lee&apos;s Summit, MO — serving the KC metro</span>
                </li>
              </ul>
              <div style={{ marginTop: 32 }} className="et-promo">
                <strong>13 · for 13</strong>
                <span>Schedule a consultation by June 13 — 13% off your package price.</span>
              </div>
            </Reveal>
            <Reveal direction="left" delay={200}>
              <InquiryForm />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="et-footer">
        <div className="et-shell">
          <div className="et-footer-mark">
            <Monogram small />
          </div>
          <div className="et-script" style={{ fontSize: "2.4rem", marginTop: 4 }}>found the one whom my soul loves</div>
          <p className="et-footer-tagline">13:13 Weddings &amp; Events · Emily &amp; Trevor Hawk · Lee&apos;s Summit, MO</p>
          <div className="et-footer-bottom">
            © 2026 · Faith. Hope. Love. · 913.213.3741
          </div>
        </div>
      </footer>

    </MouseProvider>
  );
}
