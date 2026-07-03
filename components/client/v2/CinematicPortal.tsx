"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import "./cinematic.css";

/* ─── Photo URLs (verified hotlinkable Unsplash) ─────── */
const PHOTOS = {
  home1: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80&auto=format",
  home2: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=600&q=80&auto=format",
  home3: "https://images.unsplash.com/photo-1598228723793-52759bba239c?w=600&q=80&auto=format",
  home4: "https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?w=600&q=80&auto=format",
  home5: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&q=80&auto=format",
  home6: "https://images.unsplash.com/photo-1523217582562-09d0def993a6?w=600&q=80&auto=format",
  bbq: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80&auto=format",
  golf: "https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=1200&q=80&auto=format",
  suburb: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80&auto=format",
  // Hyper-local KC landmarks (Wikimedia Commons CC)
  kcDowntown: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Downtown_Kansas_City%2C_MO.jpg/1280px-Downtown_Kansas_City%2C_MO.jpg",
  kcUnionStation: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/KCUnionStation.jpg/1280px-KCUnionStation.jpg",
  kcPlaza: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Country_Club_Plaza_1_Kansas_City_MO.jpg/1280px-Country_Club_Plaza_1_Kansas_City_MO.jpg",
  kcArrowhead: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Aerial_view_of_Arrowhead_Stadium_08-31-2013.jpg/1280px-Aerial_view_of_Arrowhead_Stadium_08-31-2013.jpg",
  kcLoosePark: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Loose_Park_Duck_Pond.jpg/1280px-Loose_Park_Duck_Pond.jpg",
  kcPowerLight: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/Kansas_City_June_2022_14_%28T-Mobile_Center%29.jpg/1280px-Kansas_City_June_2022_14_%28T-Mobile_Center%29.jpg",
  kcKauffman: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Kauffman_Center_for_Performing_Arts_2.jpg/1280px-Kauffman_Center_for_Performing_Arts_2.jpg",
};
const HOME_PHOTOS = [PHOTOS.home1, PHOTOS.home2, PHOTOS.home3, PHOTOS.home4, PHOTOS.home5, PHOTOS.home6];

/* ─── Types matching ClientPortal props ───────────────── */
interface SnapshotData {
  mortgage30yr: number | null;
  mortgage15yr: number | null;
  localKcHealth: number | null;
  nationalHealth: number | null;
  unemployment?: number | null;
  cpi?: number | null;
  consumerSentiment?: number | null;
  tickers?: Record<string, { price: number; change: number; changePercent: number }> | null;
  date?: string;
}
interface SignalData {
  id: string;
  signal: string;
  confidence: number;
  title: string;
  reasoning: string;
  scope: string;
  category: string;
  timeHorizon: string | null;
}
interface ListingData {
  id: string;
  mlsId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  daysOnMarket: number | null;
  photoUrl: string | null;
  propertyType: string | null;
  buyScore: number;
  listingUrl: string | null;
}
interface MarketStats {
  activeListings: number;
  dataPoints: number;
  activeSignals: number;
  poiCount: number;
  metroAreas: number;
}

interface CinematicPortalProps {
  snapshot: SnapshotData | null;
  snapshots: SnapshotData[];
  signals: SignalData[];
  listings: ListingData[];
  marketStats?: MarketStats;
  listingsByCity?: Record<string, number>;
}

/* ─── Hooks ───────────────────────────────────────────── */
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

const MouseCtx = createContext({ x: 0, y: 0 });
function MouseProvider({ children }: { children: ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, []);
  return <MouseCtx.Provider value={pos}>{children}</MouseCtx.Provider>;
}

/* ─── Particle Grid (canvas) ──────────────────────────── */
function ParticleGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouse = useContext(MouseCtx);
  const mouseRef = useRef(mouse);
  mouseRef.current = mouse;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    type P = { ox: number; oy: number; x: number; y: number; vx: number; vy: number };
    let particles: P[] = [];
    const SPACING = 55;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      particles = [];
      const cols = Math.ceil(w / SPACING) + 1;
      const rows = Math.ceil(h / SPACING) + 1;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          particles.push({ ox: c * SPACING, oy: r * SPACING, x: c * SPACING, y: r * SPACING, vx: 0, vy: 0 });
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const m = mouseRef.current;
      for (const p of particles) {
        const dx = p.ox - m.x;
        const dy = p.oy - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 180) {
          const force = (1 - dist / 180) * 18;
          p.vx += (dx / dist) * force * 0.06;
          p.vy += (dy / dist) * force * 0.06;
        }
        p.vx += (p.ox - p.x) * 0.04;
        p.vy += (p.oy - p.y) * 0.04;
        p.vx *= 0.88;
        p.vy *= 0.88;
        p.x += p.vx;
        p.y += p.vy;
        const proximity = dist < 180 ? (1 - dist / 180) * 0.7 : 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2 + proximity * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217,119,87,${0.06 + proximity})`;
        ctx.fill();
      }
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < SPACING * 1.5) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(217,119,87,${(1 - d / (SPACING * 1.5)) * 0.04})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="particle-canvas" />;
}

/* ─── Cursor Glow ─────────────────────────────────────── */
function CursorGlow() {
  const ref = useRef<HTMLDivElement | null>(null);
  const mouse = useContext(MouseCtx);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.left = mouse.x + "px";
      ref.current.style.top = mouse.y + "px";
    }
  }, [mouse]);
  return <div ref={ref} className="cursor-glow" />;
}

/* ─── Kinetic Text ────────────────────────────────────── */
function KineticText({
  text,
  className = "",
  delay = 0,
  tag = "span",
}: {
  text: string;
  className?: string;
  delay?: number;
  tag?: ElementType;
}) {
  const [ref, inView] = useInView<HTMLElement>(0.2);
  let charIdx = 0;
  const inner = text.split(" ").map((word, wi, arr) => (
    <span key={wi} style={{ display: "inline-block", whiteSpace: "pre" }}>
      {word.split("").map((ch, ci) => {
        const i = charIdx++;
        return (
          <span
            key={ci}
            style={{
              display: "inline-block",
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0) rotateX(0)" : "translateY(50px) rotateX(-80deg)",
              transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${delay + i * 22}ms`,
            }}
          >
            {ch}
          </span>
        );
      })}
      {wi < arr.length - 1 ? (() => { charIdx++; return <span>&nbsp;</span>; })() : null}
    </span>
  ));
  return createElement(
    tag,
    { ref, className, style: { display: "block" } },
    inner,
  );
}

/* ─── 3D Tilt Card ────────────────────────────────────── */
function TiltCard({
  children,
  className = "",
  style = {},
  intensity = 10,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  intensity?: number;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, shine: 50 });
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ rx: (y - 0.5) * -intensity, ry: (x - 0.5) * intensity, shine: x * 100 });
  };
  const reset = () => setTilt({ rx: 0, ry: 0, shine: 50 });
  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      onClick={onClick}
      style={{
        transform: `perspective(600px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.01,1.01,1.01)`,
        transition: "transform 0.15s ease-out",
        ...style,
      }}
    >
      <div
        className="tilt-shine"
        style={{ background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.04) ${tilt.shine}%, transparent 60%)` }}
      />
      {children}
    </div>
  );
}

/* ─── Flip Counter ────────────────────────────────────── */
function FlipCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [displayVal, setDisplayVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / 2200, 1);
      setDisplayVal(Math.round((1 - Math.pow(1 - p, 4)) * value));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, value]);
  return (
    <span ref={ref} className="flip-counter">
      {displayVal.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ─── Reveal & Stagger ────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  direction = "up",
  style = {},
}: {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
  style?: CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);
  const dirs = {
    up: "translateY(60px)",
    down: "translateY(-60px)",
    left: "translateX(60px)",
    right: "translateX(-60px)",
    scale: "scale(0.85)",
  };
  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "none" : dirs[direction],
        transition: `all 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
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
  delay = 80,
  className = "",
  style = {},
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const [ref, inView] = useInView<HTMLDivElement>(0.05);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = Array.isArray(children) ? children : [children];
  return (
    <div ref={ref} className={className} style={style}>
      {arr.map((child, i) => (
        <div
          key={i}
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0) scale(1)" : "translateY(40px) scale(0.95)",
            transition: `all 0.7s cubic-bezier(0.16,1,0.3,1) ${i * delay}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

/* ─── Magnetic Button ─────────────────────────────────── */
function MagButton({
  children,
  href,
  className = "",
  onClick,
  style = {},
  type,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const handleMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setOffset({
      x: (e.clientX - rect.left - rect.width / 2) * 0.25,
      y: (e.clientY - rect.top - rect.height / 2) * 0.25,
    });
  };
  const sharedStyle: CSSProperties = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    ...style,
  };
  if (href) {
    return (
      <a
        ref={(el) => { ref.current = el; }}
        href={href}
        className={`mag-btn ${className}`}
        onClick={onClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setOffset({ x: 0, y: 0 })}
        style={sharedStyle}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      ref={(el) => { ref.current = el; }}
      type={type ?? "button"}
      className={`mag-btn ${className}`}
      onClick={onClick}
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      style={sharedStyle}
    >
      {children}
    </button>
  );
}

/* ─── Parallax Banner ─────────────────────────────────── */
function ParallaxBanner({
  src,
  alt,
  height = 400,
  overlay = true,
  children,
}: {
  src?: string;
  alt?: string;
  height?: number;
  overlay?: boolean;
  children?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const onScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      setOffset((progress - 0.5) * 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={containerRef} className="parallax-banner" style={{ height }}>
      <div className="parallax-img-wrap" style={{ transform: `translateY(${offset}px) scale(1.15)` }}>
        {src ? (
          <img src={src} alt={alt ?? ""} className="parallax-img" loading="lazy" />
        ) : (
          <div className="parallax-fallback" />
        )}
      </div>
      {overlay && <div className="parallax-overlay" />}
      {children && <div className="parallax-content">{children}</div>}
    </div>
  );
}

/* ─── Listing card with safe-image fallback ───────────── */
function ListingCard({
  listing,
  index,
}: {
  listing: ListingData;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const url = listing.photoUrl ?? HOME_PHOTOS[index % HOME_PHOTOS.length];
  const cityLabel = [listing.city, listing.state].filter(Boolean).join(", ");
  const inquiryHref = `mailto:Jared@yourkchomes.com?subject=${encodeURIComponent(
    `Interested in ${listing.address || `MLS ${listing.mlsId}`}`
  )}&body=${encodeURIComponent(
    `Hi Jared,\n\nI'd like more info on:\n${listing.address || ""}${cityLabel ? `, ${cityLabel}` : ""}${listing.zip ? ` ${listing.zip}` : ""}\nMLS #${listing.mlsId}\n\nThanks!`
  )}`;
  const href = listing.listingUrl || inquiryHref;
  const isExternal = !!listing.listingUrl;

  return (
    <TiltCard className="listing-card glass-card" intensity={8}>
      <a
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        style={{ display: "block", color: "inherit", textDecoration: "none" }}
        aria-label={`View ${listing.address || `MLS ${listing.mlsId}`}`}
      >
        <div
          className="listing-img"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {imgFailed ? (
            <div className="listing-img-fallback" />
          ) : (
            <img
              src={url}
              alt={listing.address || cityLabel}
              loading="lazy"
              onError={() => setImgFailed(true)}
              style={{
                transform: hovered ? "scale(1.08)" : "scale(1)",
                transition: "transform 0.6s cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          )}
          <div className="listing-img-overlay" />
          {listing.daysOnMarket !== null && (
            <span className="listing-badge">{listing.daysOnMarket}d on market</span>
          )}
          {listing.listPrice !== null && (
            <span className="listing-price-overlay">${listing.listPrice.toLocaleString()}</span>
          )}
        </div>
        <div className="listing-info">
          <div className="listing-details">
            {listing.beds !== null && <span>{listing.beds} bd</span>}
            {listing.baths !== null && <span>{listing.baths} ba</span>}
            {listing.sqft !== null && <span>{listing.sqft.toLocaleString()} sqft</span>}
          </div>
          {cityLabel && <span className="listing-city">{cityLabel}</span>}
        </div>
      </a>
    </TiltCard>
  );
}

/* ─── Carousel card with safe fallback ────────────────── */
function CarouselCard({ src, label }: { src?: string; label: string }) {
  const [failed, setFailed] = useState(!src);
  return (
    <div className="carousel-card">
      {failed ? (
        <div className="carousel-fallback" />
      ) : (
        <img src={src} alt={label} loading="lazy" onError={() => setFailed(true)} />
      )}
      <div className="carousel-label">{label}</div>
    </div>
  );
}

/* ─── Lifestyle Carousel ──────────────────────────────── */
function LifestyleCarousel() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const images = useMemo(
    () => [
      { src: PHOTOS.kcDowntown, label: "Downtown KC" },
      { src: PHOTOS.bbq, label: "KC BBQ Capital" },
      { src: PHOTOS.golf, label: "Championship Golf" },
      { src: PHOTOS.kcLoosePark, label: "Loose Park" },
      { src: PHOTOS.kcUnionStation, label: "Union Station" },
      { src: PHOTOS.suburb, label: "Suburban Neighborhoods" },
      { src: PHOTOS.kcPowerLight, label: "Power & Light District" },
      { src: PHOTOS.kcArrowhead, label: "Arrowhead Stadium" },
      { src: PHOTOS.kcPlaza, label: "Country Club Plaza" },
      { src: PHOTOS.kcKauffman, label: "Kauffman Center" },
    ],
    [],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pos = 0;
    const speed = 0.5;
    let raf = 0;
    let paused = false;

    const onEnter = () => { paused = true; };
    const onLeave = () => { paused = false; };
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);

    const tick = () => {
      if (!paused && el.scrollWidth > 0) {
        pos += speed;
        if (pos >= el.scrollWidth / 2) pos = 0;
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const doubled = [...images, ...images];

  return (
    <section className="carousel-section">
      <Reveal>
        <h2 className="section-tag" style={{ padding: "0 1.5rem" }}>The KC Life</h2>
      </Reveal>
      <Reveal delay={100}>
        <h3 className="section-title" style={{ padding: "0 1.5rem" }}>More Than a Home — A Lifestyle</h3>
      </Reveal>
      <div className="carousel-track" ref={scrollRef}>
        {doubled.map((img, i) => (
          <CarouselCard key={i} src={img.src} label={img.label} />
        ))}
      </div>
    </section>
  );
}

/* ─── Hero ────────────────────────────────────────────── */
function Hero({
  marketStats,
}: {
  marketStats?: MarketStats;
}) {
  const [loaded, setLoaded] = useState(false);
  const scrollY = useScrollY();
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 200);
    return () => clearTimeout(t);
  }, []);

  const parallax = Math.min(scrollY * 0.4, 300);
  const heroOpacity = Math.max(1 - scrollY / 600, 0);

  const stats = useMemo(() => {
    const s = marketStats;
    return [
      { val: s?.activeListings ?? 0, label: "Active Listings" },
      { val: s?.dataPoints ?? 0, label: "Data Points", suffix: "+" },
      { val: s?.activeSignals ?? 0, label: "AI Signals" },
      { val: s?.metroAreas ?? 12, label: "Metro Areas" },
    ];
  }, [marketStats]);

  return (
    <section className="hero">
      <div className="hero-bg">
        <div className="hero-bg-mesh" style={{ transform: `translateY(${parallax}px) scale(1.1)` }} />
        <div className="hero-bg-overlay" />
      </div>

      <ParticleGrid />
      <CursorGlow />

      <div
        className="hero-content"
        style={{
          opacity: heroOpacity,
          transform: `translateY(${scrollY * 0.15}px)`,
        }}
      >
        <div
          className="live-badge"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0) scale(1)" : "translateY(20px) scale(0.9)",
            transition: "all 0.8s cubic-bezier(0.16,1,0.3,1) 0.2s",
          }}
        >
          <span className="live-dot"><span className="live-ring" /></span>
          <span>Live — 25 AI Agents Monitoring KC</span>
        </div>

        <div style={{ opacity: loaded ? 1 : 0, transition: "opacity 0.5s ease 0.5s" }}>
          <KineticText text="Your KC Real Estate" className="hero-line-1" tag="h1" delay={400} />
          <KineticText text="Intelligence Hub" className="hero-line-2 hero-accent" tag="h1" delay={900} />
        </div>

        <p
          className="hero-sub"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.9s cubic-bezier(0.16,1,0.3,1) 1.4s",
          }}
        >
          Live market data, AI-powered signals, and hyper-local listings — updated every 5 minutes.
        </p>

        <div
          className="hero-ctas"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.9s cubic-bezier(0.16,1,0.3,1) 1.6s",
          }}
        >
          <MagButton className="btn-primary btn-glow" href="#match">I&apos;m Buying</MagButton>
          <MagButton className="btn-glass" href="#match">I&apos;m Selling</MagButton>
        </div>

        <div
          className="hero-stats"
          style={{
            opacity: loaded ? 1 : 0,
            transform: loaded ? "translateY(0)" : "translateY(40px)",
            transition: "all 1s cubic-bezier(0.16,1,0.3,1) 1.9s",
          }}
        >
          {stats.map((s, i) => (
            <TiltCard key={i} className="hero-stat glass-card" intensity={8}>
              <span className="stat-num"><FlipCounter value={s.val} suffix={s.suffix || ""} /></span>
              <span className="stat-label">{s.label}</span>
            </TiltCard>
          ))}
        </div>
      </div>

      <div
        className="scroll-hint"
        style={{ opacity: loaded ? heroOpacity : 0, transition: "opacity 0.3s" }}
      >
        <div className="scroll-line" />
        <span className="scroll-text">Scroll to explore</span>
      </div>
    </section>
  );
}

/* ─── Market Pulse (uses real snapshot + signals) ─────── */
function classifySignal(sig: SignalData | null) {
  if (!sig) return { label: "Neutral", className: "neutral" };
  const v = sig.signal.toLowerCase();
  if (v.includes("buy")) return { label: "Buyer Favorable", className: "" };
  if (v.includes("sell")) return { label: "Seller Favorable", className: "" };
  if (v.includes("bear")) return { label: "Bearish", className: "bearish" };
  if (v.includes("bull")) return { label: "Bullish", className: "" };
  return { label: sig.title || sig.signal, className: "neutral" };
}

function rateChange(history: SnapshotData[], key: "mortgage30yr" | "mortgage15yr") {
  if (history.length < 2) return { delta: 0, down: false };
  const a = history[0]?.[key];
  const b = history[1]?.[key];
  if (typeof a !== "number" || typeof b !== "number") return { delta: 0, down: false };
  const delta = +(a - b).toFixed(2);
  return { delta: Math.abs(delta), down: delta < 0 };
}

function MarketPulse({
  snapshot,
  history,
  topSignal,
}: {
  snapshot: SnapshotData | null;
  history: SnapshotData[];
  topSignal: SignalData | null;
}) {
  const r30 = rateChange(history, "mortgage30yr");
  const r15 = rateChange(history, "mortgage15yr");

  const rates = [
    {
      label: "30-Year Fixed",
      value: snapshot?.mortgage30yr != null ? snapshot.mortgage30yr.toFixed(2) : "—",
      change: r30.delta.toFixed(2),
      down: r30.down,
    },
    {
      label: "15-Year Fixed",
      value: snapshot?.mortgage15yr != null ? snapshot.mortgage15yr.toFixed(2) : "—",
      change: r15.delta.toFixed(2),
      down: r15.down,
    },
  ];

  const sig = classifySignal(topSignal);
  const healthScore = Math.round(snapshot?.localKcHealth ?? 0);
  const arcMax = 264;
  const arcVal = (healthScore / 100) * arcMax;

  return (
    <section className="section">
      <Reveal><h2 className="section-tag">Market Pulse</h2></Reveal>
      <Reveal delay={100}>
        <KineticText text="Real-Time Rate & Signal Tracker" className="section-title" tag="h3" />
      </Reveal>
      <StaggerIn className="pulse-grid" delay={150}>
        {rates.map((r, i) => (
          <TiltCard key={i} className="pulse-card glass-card">
            <span className="pulse-label">{r.label}</span>
            <span className="pulse-rate">{r.value}%</span>
            <span className={`pulse-change ${r.down ? "down" : "up"}`}>
              <span className="change-arrow">{r.down ? "↓" : "↑"}</span> {r.change}%
            </span>
            <div className="rate-sparkline">
              <svg viewBox="0 0 100 30" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`kcv2-spark${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  fill={`url(#kcv2-spark${i})`}
                  d="M0,30 L0,20 10,18 20,22 30,15 40,17 50,12 60,14 70,10 80,13 90,8 100,10 100,30Z"
                  className="sparkline-fill"
                />
                <polyline
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  points="0,20 10,18 20,22 30,15 40,17 50,12 60,14 70,10 80,13 90,8 100,10"
                  className="sparkline-path"
                />
              </svg>
            </div>
          </TiltCard>
        ))}

        <TiltCard className="pulse-card glass-card">
          <span className="pulse-label">Primary Signal</span>
          <span className={`signal-badge ${sig.className}`}>
            <span className="signal-pulse" />
            {sig.label}
          </span>
          <span className="pulse-sub">
            {topSignal?.reasoning?.split(".")[0] || "Live AI signals from 25 agents."}
          </span>
        </TiltCard>

        <TiltCard className="pulse-card glass-card">
          <span className="pulse-label">KC Health Score</span>
          <div className="health-ring-wrap">
            <svg viewBox="0 0 100 100" className="health-ring">
              <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#kcv2-healthGrad)"
                strokeWidth="5"
                strokeDasharray={`${arcVal} ${arcMax}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                className="health-arc"
              />
              <defs>
                <linearGradient id="kcv2-healthGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="#10B981" />
                </linearGradient>
              </defs>
            </svg>
            <span className="health-num"><FlipCounter value={healthScore} /></span>
          </div>
        </TiltCard>
      </StaggerIn>
    </section>
  );
}

/* ─── Listings ────────────────────────────────────────── */
function Listings({ listings }: { listings: ListingData[] }) {
  const [showAll, setShowAll] = useState(false);
  if (listings.length === 0) return null;
  const visible = showAll ? listings : listings.slice(0, 6);
  return (
    <section className="section" id="listings-all">
      <Reveal><h2 className="section-tag">Homes Near Kansas City</h2></Reveal>
      <Reveal delay={100}>
        <KineticText text="Fresh Listings, Updated Live" className="section-title" tag="h3" />
      </Reveal>
      <StaggerIn className="listings-grid" delay={100}>
        {visible.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
      </StaggerIn>
      {!showAll && listings.length > 6 && (
        <Reveal delay={200}>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <MagButton className="btn-glass" onClick={() => setShowAll(true)}>
              See All {listings.length} Listings →
            </MagButton>
          </div>
        </Reveal>
      )}
    </section>
  );
}

/* ─── Metro Explorer ──────────────────────────────────── */
const METROS: { name: string; state: string; desc: string; tags: string[] }[] = [
  { name: "Kansas City", state: "MO", desc: "The heart of the metro — diverse neighborhoods, world-class BBQ, and a booming tech scene.", tags: ["Power & Light", "Country Club Plaza", "Westport", "Union Station"] },
  { name: "Overland Park", state: "KS", desc: "Top-rated schools, corporate HQs, and family-friendly suburbs.", tags: ["Top Schools", "Corporate Hub", "Arboretum"] },
  { name: "Lee's Summit", state: "MO", desc: "Fast-growing with excellent schools and lakefront living.", tags: ["Lake Lotawana", "Downtown", "Great Schools"] },
  { name: "Independence", state: "MO", desc: "Historic city — home of Harry S. Truman.", tags: ["Truman Library", "Historic Trails", "Affordable"] },
  { name: "Olathe", state: "KS", desc: "Fastest-growing city in Kansas.", tags: ["Top Schools", "Growing Economy"] },
  { name: "Blue Springs", state: "MO", desc: "Family-oriented with parks and lake access.", tags: ["Lake Jacomo", "Family Friendly"] },
  { name: "Liberty", state: "MO", desc: "Historic charm with modern amenities just north of KC.", tags: ["Historic Square", "Parks"] },
  { name: "Gladstone", state: "MO", desc: "Tight-knit community in the Northland.", tags: ["Northland", "Community"] },
  { name: "Lenexa", state: "KS", desc: "City of Festivals — booming retail & tech.", tags: ["Festivals", "Tech Hub"] },
  { name: "Shawnee", state: "KS", desc: "Family-oriented with great schools and parks.", tags: ["Top Schools", "Parks"] },
  { name: "Raytown", state: "MO", desc: "Affordable and accessible to downtown KC.", tags: ["Affordable", "Commuter"] },
  { name: "Leavenworth", state: "KS", desc: "Historic riverfront city with rich heritage.", tags: ["Historic", "Riverfront"] },
];

function MetroCard({
  metro,
  count,
}: {
  metro: (typeof METROS)[number];
  count: number;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TiltCard
      className={`metro-card glass-card ${expanded ? "expanded" : ""}`}
      intensity={6}
      style={{ cursor: "pointer" }}
      onClick={() => setExpanded(!expanded)}
    >
      <div>
        <div className="metro-header">
          <div>
            <span className="metro-name">{metro.name}</span>
            <span className="metro-state">{metro.state}</span>
          </div>
          <span className="metro-count">{count}</span>
        </div>
        <div
          style={{
            maxHeight: expanded ? "200px" : "0",
            opacity: expanded ? 1 : 0,
            transition: "all 0.6s cubic-bezier(0.16,1,0.3,1)",
            overflow: "hidden",
          }}
        >
          <p className="metro-desc">{metro.desc}</p>
          <div className="metro-tags">
            {metro.tags.map((t, i) => (
              <span
                key={i}
                className="metro-tag"
                style={{
                  transitionDelay: expanded ? `${i * 50}ms` : "0ms",
                  opacity: expanded ? 1 : 0,
                  transform: expanded ? "translateY(0)" : "translateY(10px)",
                  transition: "all 0.4s cubic-bezier(0.16,1,0.3,1)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <div
          className="metro-chevron"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 6 8 10 12 6" />
          </svg>
        </div>
      </div>
    </TiltCard>
  );
}

function MetroExplorer({
  listingsByCity,
}: {
  listingsByCity: Record<string, number>;
}) {
  const [showAll, setShowAll] = useState(false);
  const enriched = METROS.map((m) => ({
    ...m,
    count:
      listingsByCity[m.name] ??
      listingsByCity[m.name.toLowerCase()] ??
      listingsByCity[m.name.replace("'", "")] ??
      0,
  }));
  const visible = showAll ? enriched : enriched.slice(0, 4);

  return (
    <section className="section">
      <Reveal><h2 className="section-tag">KC Metro Explorer</h2></Reveal>
      <Reveal delay={100}>
        <KineticText text="12 Metro Areas, Live Data" className="section-title" tag="h3" />
      </Reveal>
      <StaggerIn className="metro-list" delay={100}>
        {visible.map((m) => <MetroCard key={m.name} metro={m} count={m.count} />)}
      </StaggerIn>
      {!showAll && (
        <Reveal delay={100}>
          <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
            <MagButton className="btn-glass" onClick={() => setShowAll(true)}>
              Show All 12 Areas
            </MagButton>
          </div>
        </Reveal>
      )}
    </section>
  );
}

/* ─── Find Match (3-question quiz) ────────────────────── */
function FindMatch() {
  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<(string | null)[]>([null, null, null]);
  const questions = [
    {
      q: "What's your budget?",
      opts: ["Up to $150K", "Up to $250K", "Up to $400K", "Up to $600K", "Up to $1M", "$1M+"],
    },
    { q: "Property type?", opts: ["Single Family", "Condo / Townhome", "Multi-Family", "Land / Lot"] },
    { q: "When are you moving?", opts: ["ASAP", "1–3 Months", "3–6 Months", "Just Browsing"] },
  ];

  const select = (val: string) => {
    const s = [...selections];
    s[step] = val;
    setSelections(s);
    setTimeout(() => setStep(step + 1), 350);
  };

  return (
    <section className="section" id="match">
      <Reveal><h2 className="section-tag">Find Your Match</h2></Reveal>
      <Reveal delay={100}>
        <KineticText text="3 Questions. AI-Matched Homes." className="section-title" tag="h3" />
      </Reveal>
      <Reveal delay={200}>
        <div className="match-container glass-card">
          {step < 3 ? (
            <div
              key={step}
              style={{
                animation: "kcv2-matchIn 0.6s cubic-bezier(0.16,1,0.3,1)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
              }}
            >
              <div className="match-progress">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="match-bar-seg">
                    <div
                      className="match-bar-fill"
                      style={{ transform: `scaleX(${i < step ? 1 : i === step ? 0.5 : 0})` }}
                    />
                  </div>
                ))}
              </div>
              <h4 className="match-question">{questions[step].q}</h4>
              <div className="match-options">
                {questions[step].opts.map((opt, i) => (
                  <button
                    key={opt}
                    className={`match-opt ${selections[step] === opt ? "selected" : ""}`}
                    onClick={() => select(opt)}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div
              className="match-result"
              style={{ animation: "kcv2-matchIn 0.6s cubic-bezier(0.16,1,0.3,1)" }}
            >
              <div className="match-check-ring">
                <svg viewBox="0 0 52 52">
                  <circle
                    cx="26" cy="26" r="24"
                    fill="none" stroke="var(--accent)" strokeWidth="2"
                    className="check-circle"
                  />
                  <path
                    fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"
                    d="M15 27l7 7 15-15"
                    className="check-mark"
                  />
                </svg>
              </div>
              <h4>We&apos;re on it!</h4>
              <p>
                AI is scanning {selections[0]} properties. Jared will reach out with personalized matches.
              </p>
              <MagButton
                className="btn-primary"
                onClick={() => {
                  setStep(0);
                  setSelections([null, null, null]);
                }}
              >
                Start Over
              </MagButton>
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Agent Card ──────────────────────────────────────── */
function AgentCard() {
  return (
    <section className="section agent-section">
      <Reveal>
        <TiltCard className="agent-card glass-card" intensity={6}>
          <div className="agent-glow" />
          <div className="agent-photo"><div className="agent-initials">JT</div></div>
          <h3 className="agent-name">Jared Tolley</h3>
          <p className="agent-company">Your KC Homes LLC</p>
          <p className="agent-brokerage">United Real Estate Kansas City</p>
          <p className="agent-bio">
            Kansas City native with deep local expertise. Backed by AI-powered market analysis monitoring
            mortgage rates, housing data, and listings 24/7.
          </p>
          <div className="agent-areas">
            {["Kansas City", "Independence", "Lee's Summit", "Blue Springs", "Overland Park"].map((a) => (
              <span key={a} className="agent-area-tag">{a}</span>
            ))}
          </div>
          <div className="agent-ctas">
            <MagButton className="btn-primary btn-glow" href="tel:913-283-3826">Call Now</MagButton>
            <MagButton className="btn-glass" href="mailto:Jared@yourkchomes.com">Email</MagButton>
          </div>
        </TiltCard>
      </Reveal>
    </section>
  );
}

/* ─── Stay Connected ──────────────────────────────────── */
function StayConnected() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async () => {
    if (!email || !/.+@.+\..+/.test(email)) {
      setError("Enter a valid email");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/client/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "kc-v2" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(true);
    } catch (err) {
      console.error("[kc-v2 subscribe]", err);
      setError("Something went wrong — try again");
    } finally {
      setLoading(false);
    }
  }, [email]);

  return (
    <section className="section">
      <Reveal><h2 className="section-tag">Stay Connected</h2></Reveal>
      <Reveal delay={100}>
        <KineticText text="Weekly Market Intel, Delivered" className="section-title" tag="h3" />
      </Reveal>
      <Reveal delay={200}>
        <div className="subscribe-card glass-card">
          {!submitted ? (
            <>
              <div className="subscribe-form">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="subscribe-input"
                  aria-label="Email address"
                />
                <MagButton className="btn-primary" onClick={submit}>
                  {loading ? "…" : "Subscribe"}
                </MagButton>
              </div>
              {error && (
                <p style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "0.75rem", textAlign: "center" }}>
                  {error}
                </p>
              )}
            </>
          ) : (
            <div
              className="subscribe-success"
              style={{ animation: "kcv2-matchIn 0.5s cubic-bezier(0.16,1,0.3,1)" }}
            >
              <span className="success-icon">✓</span>
              <p>You&apos;re in! Watch your inbox.</p>
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Marquee ─────────────────────────────────────────── */
function Marquee({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee-wrap">
      <div className="marquee-track">
        {doubled.map((item, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
            <span className="marquee-item">{item}</span>
            <span className="marquee-dot">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Root ────────────────────────────────────────────── */
export function CinematicPortal({
  snapshot,
  snapshots,
  signals,
  listings,
  marketStats,
  listingsByCity,
}: CinematicPortalProps) {
  const topSignal = signals[0] ?? null;

  return (
    <MouseProvider>
      <div className="kc-v2">
        <div className="kc-v2-app">
          <Hero marketStats={marketStats} />

          <ParallaxBanner src={PHOTOS.kcDowntown} alt="Kansas City skyline" height={350}>
            <Reveal>
              <h2 className="parallax-title">Life in Kansas City</h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.1rem", marginTop: "0.5rem" }}>
                The City of Fountains
              </p>
            </Reveal>
          </ParallaxBanner>

          <MarketPulse snapshot={snapshot} history={snapshots} topSignal={topSignal} />
          <LifestyleCarousel />
          <Listings listings={listings} />

          <ParallaxBanner src={PHOTOS.kcPlaza} alt="Country Club Plaza" height={300}>
            <Reveal><h2 className="parallax-title">World-Class Living</h2></Reveal>
          </ParallaxBanner>

          <MetroExplorer listingsByCity={listingsByCity ?? {}} />
          <FindMatch />

          <ParallaxBanner src={PHOTOS.kcArrowhead} alt="Arrowhead Stadium" height={300}>
            <Reveal><h2 className="parallax-title">Your City. Your Home.</h2></Reveal>
          </ParallaxBanner>

          <AgentCard />
          <StayConnected />

          <footer className="footer">
            <Marquee
              items={[
                "Kansas City",
                "Overland Park",
                "Olathe",
                "Lee's Summit",
                "Independence",
                "Blue Springs",
                "Raytown",
                "Liberty",
                "Gladstone",
                "Lenexa",
                "Shawnee",
                "Leavenworth",
              ]}
            />
            <div className="footer-inner">
              <p>© {new Date().getFullYear()} Your KC Homes LLC — Jared Tolley</p>
              <p className="footer-sub">
                United Real Estate Kansas City · Data refreshed every 5 min by AI agents
              </p>
              <div className="footer-links">
                <a href="https://www.facebook.com/yourkchomes">Facebook</a>
                <a href="https://www.instagram.com/yourkchomes">Instagram</a>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </MouseProvider>
  );
}
