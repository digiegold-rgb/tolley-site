"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CamSwitcher from "./CamSwitcher";
import ShowFx, { type ShowFxHandle } from "./ShowFx";
import { api, money, pctUnderAmazon, type Lineup, type LineupItem } from "./lineup-types";

// /stream/products/<slug> — the clicker. This window stays on the MacBook; "Open big-screen window" opens ONE
// named browser window that you drag to the TV and fullscreen. Every advance re-navigates that same window to the
// next product's live Amazon page (plain /dp/ link, no affiliate tag — it is your own screen).
//
// Keys: → / Space / PageDown next · ← / PageUp prev · ↑ ↓ photos · A re-open Amazon · S sold · 1–4 cut cameras (CamSwitcher)
//       C celebrate now · X auto-effects on/off · H hide the operator controls (clean show screen) · L mirror the layout
//       P compare label: Amazon → "Compare at" → hidden · F full screen.
// A USB presenter remote sends PageUp/PageDown, so it works as-is.
//
// This page is ALSO a show screen (it is on camera behind the host): photos run as a slideshow, the price block moves,
// and ShowFx throws confetti / fireworks / callouts at random and on SOLD.

const BIG_SCREEN = "tolley-amazon";
const SLIDE_MS = 3500;          // photo slideshow pace
const MANUAL_HOLD_MS = 12000;   // after a manual photo change, hold that photo this long before the slideshow resumes
type Compare = "amazon" | "generic" | "off";
type Prefs = { clean: boolean; mirror: boolean; fx: boolean; compare: Compare };
const PREFS_KEY = "stream-clicker-prefs";
const DEFAULT_PREFS: Prefs = { clean: false, mirror: true, fx: true, compare: "amazon" };

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...(JSON.parse(window.localStorage.getItem(PREFS_KEY) || "{}") as Partial<Prefs>) }; } catch { return DEFAULT_PREFS; }
}

function typing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export default function LineupClicker({ slug }: { slug: string }) {
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [idx, setIdx] = useState(0);
  const [err, setErr] = useState("");
  const [bigOpen, setBigOpen] = useState(false);
  const bigWin = useRef<Window | null>(null);
  const saveTimer = useRef<number | null>(null);
  const fx = useRef<ShowFxHandle | null>(null);
  const holdUntil = useRef(0);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const setPref = useCallback((patch: Partial<Prefs>) => {
    setPrefs((cur) => {
      const next = { ...cur, ...patch };
      try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private window — prefs just don't stick */ }
      return next;
    });
  }, []);
  useEffect(() => { const t = window.setTimeout(() => setPrefs(loadPrefs()), 0); return () => window.clearTimeout(t); }, []);
  const calloutsRef = useRef<string[]>([]);

  const items = useMemo(() => lineup?.items ?? [], [lineup]);
  const item: LineupItem | undefined = items[idx];

  // Which of the current item's photos is showing (↑/↓ or the ‹ › buttons). Keyed by item so a new product starts at photo 1.
  const [pic, setPic] = useState<{ id: string; n: number }>({ id: "", n: 0 });
  const photos = item?.product.imageUrls ?? [];
  const picAt = item && pic.id === item.id ? Math.min(pic.n, Math.max(0, photos.length - 1)) : 0;
  const flipPic = useCallback((by: number) => {
    if (!item || photos.length < 2) return;
    holdUntil.current = Date.now() + MANUAL_HOLD_MS;
    setPic({ id: item.id, n: ((picAt + by) % photos.length + photos.length) % photos.length });
  }, [item, photos.length, picAt]);

  // Photo slideshow: advances by itself; a manual change (↑ ↓, ‹ ›, thumbnail) holds that photo for a while first.
  const itemId = item?.id ?? "";
  const nPhotos = photos.length;
  useEffect(() => {
    if (!itemId || nPhotos < 2) return;
    const t = window.setInterval(() => {
      if (document.hidden || Date.now() < holdUntil.current) return;
      setPic((cur) => ({ id: itemId, n: ((cur.id === itemId ? cur.n : 0) + 1) % nPhotos }));
    }, SLIDE_MS);
    return () => window.clearInterval(t);
  }, [itemId, nPhotos]);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const j = await api<{ lineup: Lineup }>(`/api/stream-lineup/${slug}`);
        if (stop) return;
        setLineup(j.lineup);
        setIdx(Math.min(Math.max(0, j.lineup.currentIndex), Math.max(0, j.lineup.items.length - 1)));
        // Opening the clicker makes this THE lineup: /stream shows its "Now selling" line.
        if (!j.lineup.active) void api(`/api/stream-lineup/${slug}`, "PATCH", { active: true }).catch(() => undefined);
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : "Could not load the lineup");
      }
    })();
    return () => { stop = true; };
  }, [slug]);

  // Track the big-screen window being closed by hand.
  useEffect(() => {
    const t = window.setInterval(() => setBigOpen(!!bigWin.current && !bigWin.current.closed), 1500);
    return () => window.clearInterval(t);
  }, []);

  /** Point the big-screen window at `url`. `force` opens it if it isn't open yet (must come from a click/keypress). */
  const show = useCallback((url: string | null | undefined, force: boolean) => {
    if (!url) return;
    const alive = !!bigWin.current && !bigWin.current.closed;
    if (!alive && !force) return;
    // Re-navigate the window we already hold; only fall back to window.open (same name every time, so the
    // browser reuses that window rather than stacking new ones) when there is no live handle.
    // The opener link is left intact on purpose — disowning it would stop the browser matching the name.
    let sent = false;
    if (alive) {
      try { bigWin.current!.location.href = url; sent = true; } catch { /* fall through to window.open */ }
    }
    if (!sent) {
      const w = window.open(url, BIG_SCREEN);
      if (w) bigWin.current = w;
    }
    setBigOpen(!!bigWin.current && !bigWin.current.closed);
    // On an advance, keep the keyboard here so the next arrow press still lands on the clicker.
    // (Not on an explicit open — that window needs to stay in front to be dragged to the TV.)
    if (!force) window.setTimeout(() => window.focus(), 150);
  }, []);

  const go = useCallback((to: number) => {
    if (!items.length) return;
    const next = Math.min(Math.max(0, to), items.length - 1);
    if (next === idx) return;
    setIdx(next);
    holdUntil.current = 0;
    fx.current?.confetti(90);
    show(items[next].amazonUrl, false);
    // Debounced + fire-and-forget: holding → through ten items writes once.
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void api(`/api/stream-lineup/${slug}`, "PATCH", { currentIndex: next }).catch(() => undefined);
    }, 400);
  }, [items, idx, show, slug]);

  const saleBusy = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!saleBusy.current) void api<{lineup: Lineup}>(`/api/stream-lineup/${slug}`).then(j => setLineup(j.lineup)).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slug]);
  const saleRequest = useRef<{itemId: string; sold: boolean; key: string} | null>(null);
  const toggleSold = useCallback(async () => {
    if (!item || saleBusy.current) return;
    saleBusy.current = true;
    const sold = !item.soldAt;
    if (!saleRequest.current || saleRequest.current.itemId !== item.id || saleRequest.current.sold !== sold) saleRequest.current = {itemId: item.id, sold, key: crypto.randomUUID()};
    try {
      const result = await api<{ item: LineupItem }>(`/api/stream-lineup/${slug}/items/${item.id}`, "PATCH", { sold, key: saleRequest.current.key });
      saleRequest.current = null;
      setLineup(l => l ? { ...l, items: l.items.map(i => i.id === item.id ? result.item : i) } : l);
      setErr("");
      if (sold) { fx.current?.fireworks(7); fx.current?.callout("One sold!"); }
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save. Retry to check the result."); }
    finally { saleBusy.current = false; }
  }, [item, slug]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing()) return;
      switch (e.key) {
        case "ArrowRight": case " ": case "PageDown": e.preventDefault(); go(idx + 1); break;
        case "ArrowLeft": case "PageUp": e.preventDefault(); go(idx - 1); break;
        case "ArrowDown": e.preventDefault(); flipPic(1); break;
        case "ArrowUp": e.preventDefault(); flipPic(-1); break;
        case "a": case "A": e.preventDefault(); show(item?.amazonUrl, true); break;
        case "s": case "S": e.preventDefault(); void toggleSold(); break;
        case "c": case "C": e.preventDefault(); fx.current?.random(calloutsRef.current); break;
        case "x": case "X": e.preventDefault(); setPref({ fx: !prefs.fx }); break;
        case "h": case "H": e.preventDefault(); setPref({ clean: !prefs.clean }); break;
        case "l": case "L": e.preventDefault(); setPref({ mirror: !prefs.mirror }); break;
        case "p": case "P": e.preventDefault(); setPref({ compare: prefs.compare === "amazon" ? "generic" : prefs.compare === "generic" ? "off" : "amazon" }); break;
        case "f": case "F": e.preventDefault(); if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => undefined); break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx, item, show, toggleSold, flipPic, prefs, setPref]);

  // Random show effects every 25–50 s while auto-effects are on.
  useEffect(() => {
    if (!prefs.fx) return;
    let t = 0;
    const arm = () => { t = window.setTimeout(() => { if (!document.hidden) fx.current?.random(calloutsRef.current); arm(); }, 25000 + Math.random() * 25000); };
    arm();
    return () => window.clearTimeout(t);
  }, [prefs.fx]);

  const pct = item ? pctUnderAmazon(item.salePrice, item.amazonPriceCents) : null;
  // A compare price only goes on screen for an Amazon match Jared has personally verified — a wrong comparison on a
  // live sale is a deceptive-pricing problem, not a cosmetic one.
  const showCompare = prefs.compare !== "off" && !!item?.amazonPriceCents && !!item?.amazonVerified;
  const compareLabel = prefs.compare === "amazon" ? "AMAZON" : "COMPARE AT";
  const callouts = useMemo(() => [
    "🔥 HOT DEAL", "⚡ GOING FAST", "🎉 LET’S GO!", "💥 BOOM!", "🛒 GRAB IT!", "👀 LOOK AT THAT PRICE",
    ...(showCompare && pct ? [`💸 SAVE ${pct}%`, prefs.compare === "amazon" ? "🏆 BEATS AMAZON" : "🏆 BEATS RETAIL"] : []),
  ], [showCompare, pct, prefs.compare]);
  useEffect(() => { calloutsRef.current = callouts; }, [callouts]);

  if (err && !lineup) {
    return <main style={S.wrap}><div style={S.banner}>{err}</div><Link href="/stream/products" style={S.a}>← lineups</Link></main>;
  }
  if (!lineup) return <main style={S.wrap}><div style={{ color: "#9aa" }}>Loading…</div></main>;


  const soldCount = items.filter((i) => i.soldAt).length;

  return (
    <main style={S.wrap}>
      <style>{`
        @keyframes tsc-now { 0%,100% { transform: scale(1) rotate(-1.5deg) } 25% { transform: scale(1.07) rotate(1.2deg) } 50% { transform: scale(1) rotate(-0.6deg) } 75% { transform: scale(1.1) rotate(1.8deg) } }
        @keyframes tsc-glow { 0%,100% { filter: drop-shadow(0 0 10px rgba(46,204,113,.55)) } 50% { filter: drop-shadow(0 0 34px rgba(255,214,10,.95)) } }
        @keyframes tsc-shine { 0% { background-position: 0% 50% } 100% { background-position: 200% 50% } }
        @keyframes tsc-strike { 0% { width: 0 } 60%,100% { width: 108% } }
        @keyframes tsc-badge { 0%,100% { transform: rotate(-8deg) scale(1) } 50% { transform: rotate(6deg) scale(1.14) } }
        @keyframes tsc-kb { 0% { transform: scale(1) } 100% { transform: scale(1.07) } }
        @keyframes tsc-in { 0% { opacity: 0; transform: translateY(18px) scale(.97) } 100% { opacity: 1; transform: none } }
        @keyframes tsc-border { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }
      `}</style>
      <ShowFx ref={fx} />

      {!prefs.clean && (
        <div style={S.top}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
            <span style={S.pos}>{items.length ? idx + 1 : 0} / {items.length}</span>
            <span style={{ color: "#9ab", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lineup.name} · {soldCount} sold</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button style={{ ...S.btn, ...S.small, ...(bigOpen ? S.secondary : S.primary) }} onClick={() => show(item?.amazonUrl ?? "https://www.amazon.com/", true)}>
              {bigOpen ? "🖥 Amazon window open — re-send" : "🖥 Open Amazon window"}
            </button>
            <button style={{ ...S.btn, ...S.small, ...S.secondary }} onClick={() => fx.current?.random(callouts)} title="C">🎉 celebrate</button>
            <button style={{ ...S.btn, ...S.small, ...S.secondary }} onClick={() => setPref({ fx: !prefs.fx })} title="X">auto effects: {prefs.fx ? "ON" : "off"}</button>
            <button style={{ ...S.btn, ...S.small, ...S.secondary }} onClick={() => setPref({ compare: prefs.compare === "amazon" ? "generic" : prefs.compare === "generic" ? "off" : "amazon" })} title="P">
              compare: {prefs.compare === "amazon" ? "“Amazon”" : prefs.compare === "generic" ? "“Compare at”" : "hidden"}
            </button>
            <button style={{ ...S.btn, ...S.small, ...S.secondary }} onClick={() => setPref({ mirror: !prefs.mirror })} title="L">⇄ swap sides</button>
            <button style={{ ...S.btn, ...S.small, ...S.secondary }} onClick={() => setPref({ clean: true })} title="H">hide controls</button>
            <a href={`/stream/products?l=${encodeURIComponent(slug)}`} style={S.a}>✎ edit</a>
            <Link href="/stream" style={S.a}>📡 stream</Link>
          </div>
        </div>
      )}

      {err && <div style={S.banner} onClick={() => setErr("")}>{err}</div>}

      {!item ? (
        <p style={{ color: "#9aa" }}>This lineup is empty. <a href={`/stream/products?l=${encodeURIComponent(slug)}`} style={S.a}>Add products →</a></p>
      ) : (
        <div style={{ ...S.cols, flexDirection: prefs.mirror ? "row-reverse" : "row" }}>
          {/* ── the product: big photo slideshow + title + moving price ── */}
          <section key={item.id} style={S.stage}>
            <div style={S.frame}>
              <div style={{ ...S.photo, height: prefs.clean ? "min(62vh, 760px)" : "min(52vh, 640px)" }}>
                {photos.map((u, k) => (
                  // eslint-disable-next-line @next/next/no-img-element -- Blob URL from the shop, owner-only page
                  <img key={u} src={u} alt="" style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
                    opacity: k === picAt ? 1 : 0, transition: "opacity .7s ease",
                    animation: k === picAt ? `tsc-kb ${SLIDE_MS + 900}ms ease-out forwards` : "none",
                  }} />
                ))}
                {item.soldAt && <span style={S.sold}>SOLD</span>}
                {item.quantity > 1 && !item.soldAt && <span style={S.qty}>{Math.max(0, item.quantity - (item.soldQuantity ?? 0))} left in lineup</span>}
                {photos.length > 1 && (
                  <>
                    <button type="button" aria-label="Previous photo" style={{ ...S.picArrow, left: 8, opacity: prefs.clean ? 0 : 1 }} onClick={() => flipPic(-1)}>‹</button>
                    <button type="button" aria-label="Next photo" style={{ ...S.picArrow, right: 8, opacity: prefs.clean ? 0 : 1 }} onClick={() => flipPic(1)}>›</button>
                    <div style={S.dots}>{photos.map((u, k) => <span key={u} onClick={() => { holdUntil.current = Date.now() + MANUAL_HOLD_MS; setPic({ id: item.id, n: k }); }} style={{ ...S.dot, ...(k === picAt ? S.dotOn : {}) }} />)}</div>
                  </>
                )}
              </div>
            </div>

            <h1 style={S.title}>{item.product.title}</h1>

            <div style={S.priceRow}>
              {showCompare && (
                <div style={S.was}>
                  <span style={S.wasLabel}>{compareLabel}</span>
                  <span style={S.wasPrice}>
                    {money((item.amazonPriceCents ?? 0) / 100)}
                    <span style={S.strike} />
                  </span>
                </div>
              )}
              <div style={S.nowWrap}>
                <span style={S.nowLabel}>{showCompare ? "OUR PRICE" : "TODAY"}</span>
                <span style={S.nowPrice}>{money(item.salePrice)}</span>
              </div>
              {showCompare && pct ? <span style={S.badge}>SAVE<br /><b style={{ fontSize: "1.5em" }}>{pct}%</b></span> : null}
            </div>
            {showCompare && prefs.compare === "amazon" && (
              <div style={S.fine}>Amazon.com price for the same new item, checked {item.amazonPriceAt ? new Date(item.amazonPriceAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "recently"} · prices change</div>
            )}

            {!prefs.clean && (
              <>
                <div style={{ fontSize: 14, color: "#9ab", display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
                  <span style={{ color: item.quantity > 1 ? "#ffd166" : "#9ab", fontWeight: 600 }}>qty {item.quantity}</span>
                  {item.weightOz ? <span>⚖ {item.weightOz} oz ({(item.weightOz / 16).toFixed(1)} lb)</span> : <span style={{ color: "#f5c542" }}>⚖ no weight</span>}
                  {item.lengthIn && item.widthIn && item.heightIn ? <span>📦 {item.lengthIn} × {item.widthIn} × {item.heightIn} in</span> : <span style={{ color: "#f5c542" }}>📦 no box size</span>}
                  {item.tiktokListed ? <span style={{ color: "#69e0ff" }}>✓ in TikTok Shop</span> : <span style={{ color: "#f5c542" }}>not in TikTok Shop yet</span>}
                  {!item.amazonUrl ? <span style={{ color: "#ff7b6b" }}>⚠ no Amazon link</span>
                    : !item.amazonVerified ? <span style={{ color: "#f5c542" }}>⚠ Amazon match not verified — compare price stays hidden until you tick ✓ on the lineup page</span> : null}
                </div>
                {item.notes && <p style={S.notes}>{item.notes}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button style={{ ...S.btn, ...S.secondary }} onClick={() => go(idx - 1)} disabled={idx === 0}>← prev</button>
                  <button style={{ ...S.btn, ...S.primary, minWidth: 140 }} onClick={() => go(idx + 1)} disabled={idx >= items.length - 1}>next →</button>
                  <button style={{ ...S.btn, ...(item.soldAt ? S.soldBtn : S.secondary) }} onClick={() => void toggleSold()}>{item.soldAt ? "✓ SOLD (S to undo)" : "Sell one unit (S)"}</button>
                  <button style={{ ...S.btn, ...S.secondary }} onClick={() => show(item.amazonUrl, true)} disabled={!item.amazonUrl}>Amazon (A)</button>
                </div>
              </>
            )}
          </section>

          {/* ── the lineup ── */}
          <aside style={S.side}>
            <div style={S.label}>Up next</div>
            {items.slice(idx + 1, idx + 4).map((n, k) => (
              <button key={n.id} style={S.next} onClick={() => go(idx + 1 + k)}>
                <MiniThumb src={n.product.imageUrls[0]} />
                <span style={S.nextText}>{n.product.title}</span>
                <span style={{ color: "#9ab", fontSize: 13 }}>{money(n.salePrice)}</span>
              </button>
            ))}
            {idx >= items.length - 1 && <div style={{ color: "#789", fontSize: 14, padding: "6px 0" }}>That&apos;s the last one.</div>}

            <div style={{ ...S.label, marginTop: 14 }}>Lineup</div>
            <div style={S.jump}>
              {items.map((n, k) => (
                <button key={n.id} style={{ ...S.jumpRow, ...(k === idx ? S.jumpOn : {}), opacity: n.soldAt ? 0.5 : 1 }} onClick={() => go(k)}>
                  <span style={{ width: 24, textAlign: "right", color: "#789", fontVariantNumeric: "tabular-nums" }}>{k + 1}</span>
                  <span style={S.nextText}>{n.product.title}</span>
                  {n.soldAt && <span style={{ color: "#2ecc71", fontSize: 11 }}>SOLD</span>}
                </button>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* Kept mounted even in clean mode: it owns the 1–4 camera hotkeys. */}
      <div style={prefs.clean ? { display: "none" } : { marginTop: 16, maxWidth: 560 }}>
        <CamSwitcher compact />
      </div>
      {!prefs.clean && (
        <div style={{ marginTop: 10, fontSize: 12, color: "#678" }}>
          → / Space / PageDown next · ← / PageUp prev · ↑ ↓ photos (slideshow resumes after 12 s) · S sold · C celebrate · X auto effects · P compare label · L swap sides · H hide controls · F full screen · A Amazon window · 1–4 cameras
        </div>
      )}
      {prefs.clean && <button aria-label="Show controls" onClick={() => setPref({ clean: false })} style={S.unhide}>H</button>}
    </main>
  );
}

function MiniThumb({ src }: { src?: string }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element -- Blob URL from the shop, owner-only page
    ? <img src={src} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
    : <span style={{ width: 40, height: 40, borderRadius: 6, background: "#0a0f1a", flexShrink: 0 }} />;
}

const S: Record<string, React.CSSProperties> = {
  wrap: { margin: "0 auto", padding: "12px 18px 24px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#eef", minHeight: "100vh", boxSizing: "border-box", overflow: "hidden",
    background: "radial-gradient(1200px 700px at 70% 10%, #1b2d52 0%, #0b1220 55%, #070b14 100%)" },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 },
  pos: { fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  a: { color: "#8ab", fontSize: 14, textDecoration: "none" },
  banner: { background: "#5a1f1a", color: "#ffd", padding: "10px 12px", borderRadius: 10, marginBottom: 12, fontSize: 14, cursor: "pointer" },
  cols: { display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" },
  stage: { flex: "4 1 620px", minWidth: 0, animation: "tsc-in .45s ease-out" },
  side: { flex: "1 1 260px", maxWidth: 340, minWidth: 0 },
  frame: { padding: 5, borderRadius: 22, backgroundImage: "linear-gradient(90deg,#ff2d55,#ffd60a,#2ecc71,#4a90e2,#c77dff,#ff2d55)", backgroundSize: "300% 100%", animation: "tsc-border 7s linear infinite", boxShadow: "0 18px 60px rgba(0,0,0,.55)" },
  photo: { position: "relative", height: "min(62vh, 760px)", background: "#0a0f1a", borderRadius: 18, overflow: "hidden" },
  picArrow: { position: "absolute", top: "50%", transform: "translateY(-50%)", width: 52, height: 84, border: "none", borderRadius: 12, background: "rgba(5,10,20,0.55)", color: "#fff", fontSize: 36, cursor: "pointer", transition: "opacity .2s" },
  dots: { position: "absolute", left: 0, right: 0, bottom: 12, display: "flex", justifyContent: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 999, background: "rgba(255,255,255,.35)", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.6)" },
  dotOn: { background: "#fff", width: 30 },
  sold: { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%) rotate(-14deg)", background: "rgba(46,204,113,.92)", color: "#052", fontWeight: 900, fontSize: "clamp(48px, 9vw, 150px)", letterSpacing: 6, borderRadius: 18, padding: "0 .35em", border: "6px solid #fff", boxShadow: "0 10px 50px rgba(0,0,0,.6)" },
  qty: { position: "absolute", left: 14, top: 14, background: "#ffd60a", color: "#221", fontWeight: 800, borderRadius: 10, padding: "5px 12px", fontSize: 18 },
  title: { fontSize: "clamp(24px, 2.6vw, 44px)", lineHeight: 1.15, margin: "16px 0 0", textShadow: "0 2px 10px rgba(0,0,0,.6)" },
  priceRow: { display: "flex", alignItems: "center", gap: "clamp(18px, 3vw, 54px)", flexWrap: "wrap", margin: "14px 0 0" },
  was: { display: "grid", gap: 2 },
  wasLabel: { fontSize: "clamp(13px, 1.2vw, 20px)", fontWeight: 800, letterSpacing: 2, color: "#ff8fa3" },
  wasPrice: { position: "relative", display: "inline-block", fontSize: "clamp(38px, 5vw, 92px)", fontWeight: 800, color: "#ffb3c1", lineHeight: 1, padding: "0 4px", background: "rgba(255,45,85,.16)", borderRadius: 10 },
  strike: { position: "absolute", left: "-4%", top: "50%", height: "0.11em", background: "#ff2d55", borderRadius: 4, transform: "rotate(-9deg)", boxShadow: "0 0 14px rgba(255,45,85,.9)", animation: "tsc-strike 3.2s ease-out infinite" },
  nowWrap: { display: "grid", gap: 2, transformOrigin: "left center", animation: "tsc-now 2.4s ease-in-out infinite, tsc-glow 1.8s ease-in-out infinite" },
  nowLabel: { fontSize: "clamp(13px, 1.2vw, 20px)", fontWeight: 800, letterSpacing: 2, color: "#9dffc4" },
  nowPrice: { fontSize: "clamp(64px, 9vw, 170px)", fontWeight: 900, lineHeight: 0.95, backgroundImage: "linear-gradient(90deg,#2ecc71,#ffd60a,#ffffff,#ffd60a,#2ecc71)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", animation: "tsc-shine 2.2s linear infinite" },
  badge: { display: "grid", placeItems: "center", textAlign: "center", width: "clamp(96px, 9vw, 170px)", height: "clamp(96px, 9vw, 170px)", borderRadius: "50%", background: "radial-gradient(circle at 30% 30%, #ff5d7a, #d90429)", color: "#fff", fontWeight: 900, fontSize: "clamp(14px, 1.5vw, 26px)", lineHeight: 1.05, border: "4px dashed #ffd60a", boxShadow: "0 8px 30px rgba(217,4,41,.6)", animation: "tsc-badge 1.6s ease-in-out infinite" },
  fine: { fontSize: 12, color: "#8a9bb5", marginTop: 8 },
  notes: { fontSize: 16, color: "#dfe", background: "#111a2b", borderRadius: 10, padding: "8px 10px", whiteSpace: "pre-wrap", margin: "12px 0 0" },
  btn: { fontSize: 16, fontWeight: 600, padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer" },
  small: { fontSize: 13, padding: "8px 11px", borderRadius: 10 },
  primary: { background: "#2ecc71", color: "#062" },
  secondary: { background: "#1c2940", color: "#dde" },
  soldBtn: { background: "#123222", color: "#2ecc71", border: "1px solid #2ecc71" },
  label: { fontSize: 11, color: "#8a9", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  next: { display: "flex", alignItems: "center", gap: 10, width: "100%", background: "rgba(17,26,43,.85)", border: "none", borderRadius: 10, padding: 6, marginBottom: 6, color: "#eef", cursor: "pointer" },
  nextText: { flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 },
  jump: { maxHeight: "46vh", overflowY: "auto", background: "rgba(14,22,38,.85)", border: "1px solid #223", borderRadius: 10, padding: 4 },
  jumpRow: { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", borderRadius: 6, padding: "5px 6px", color: "#dde", cursor: "pointer", fontSize: 13 },
  jumpOn: { background: "#1f3a5f", color: "#fff" },
  unhide: { position: "fixed", right: 8, bottom: 8, width: 26, height: 26, borderRadius: 8, border: "none", background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.25)", fontSize: 11, cursor: "pointer", zIndex: 90 },
};
