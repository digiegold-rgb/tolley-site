"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import CamSwitcher from "./CamSwitcher";
import { api, money, pctUnderAmazon, type Lineup, type LineupItem } from "./lineup-types";

// /stream/products/<slug> — the clicker. This window stays on the MacBook; "Open big-screen window" opens ONE
// named browser window that you drag to the TV and fullscreen. Every advance re-navigates that same window to the
// next product's live Amazon page (plain /dp/ link, no affiliate tag — it is your own screen).
//
// Keys: → / Space / PageDown next · ← / PageUp prev · A re-open Amazon · S sold · 1–4 cut cameras (CamSwitcher).
// A USB presenter remote sends PageUp/PageDown, so it works as-is.

const BIG_SCREEN = "tolley-amazon";

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

  const items = useMemo(() => lineup?.items ?? [], [lineup]);
  const item: LineupItem | undefined = items[idx];

  // Which of the current item's photos is showing (↑/↓ or the ‹ › buttons). Keyed by item so a new product starts at photo 1.
  const [pic, setPic] = useState<{ id: string; n: number }>({ id: "", n: 0 });
  const photos = item?.product.imageUrls ?? [];
  const picAt = item && pic.id === item.id ? Math.min(pic.n, Math.max(0, photos.length - 1)) : 0;
  const flipPic = useCallback((by: number) => {
    if (!item || photos.length < 2) return;
    setPic({ id: item.id, n: ((picAt + by) % photos.length + photos.length) % photos.length });
  }, [item, photos.length, picAt]);

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
    show(items[next].amazonUrl, false);
    // Debounced + fire-and-forget: holding → through ten items writes once.
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void api(`/api/stream-lineup/${slug}`, "PATCH", { currentIndex: next }).catch(() => undefined);
    }, 400);
  }, [items, idx, show, slug]);

  const toggleSold = useCallback(async () => {
    if (!item) return;
    const sold = !item.soldAt;
    setLineup((l) => (l ? { ...l, items: l.items.map((i) => (i.id === item.id ? { ...i, soldAt: sold ? new Date().toISOString() : null } : i)) } : l));
    try { await api(`/api/stream-lineup/${slug}/items/${item.id}`, "PATCH", { sold }); } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
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
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, idx, item, show, toggleSold, flipPic]);

  if (err && !lineup) {
    return <main style={S.wrap}><div style={S.banner}>{err}</div><Link href="/stream/products" style={S.a}>← lineups</Link></main>;
  }
  if (!lineup) return <main style={S.wrap}><div style={{ color: "#9aa" }}>Loading…</div></main>;

  const pct = item ? pctUnderAmazon(item.salePrice, item.amazonPriceCents) : null;
  const soldCount = items.filter((i) => i.soldAt).length;

  return (
    <main style={S.wrap}>
      <div style={S.top}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
          <span style={S.pos}>{items.length ? idx + 1 : 0} / {items.length}</span>
          <span style={{ color: "#9ab", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lineup.name} · {soldCount} sold</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button style={{ ...S.btn, ...(bigOpen ? S.secondary : S.primary) }} onClick={() => show(item?.amazonUrl ?? "https://www.amazon.com/", true)}>
            {bigOpen ? "🖥 Big screen open — re-send" : "🖥 Open big-screen window"}
          </button>
          <a href={`/stream/products?l=${encodeURIComponent(slug)}`} style={S.a}>✎ edit lineup</a>
          <Link href="/stream" style={S.a}>📡 stream</Link>
        </div>
      </div>

      {err && <div style={S.banner} onClick={() => setErr("")}>{err}</div>}
      {!bigOpen && (
        <div style={S.hint}>
          Click <b>Open big-screen window</b>, drag that window to the TV, press <b>⌃⌘F</b> for full screen, then click back here. Arrow keys do the rest.
        </div>
      )}

      {!item ? (
        <p style={{ color: "#9aa" }}>This lineup is empty. <a href={`/stream/products?l=${encodeURIComponent(slug)}`} style={S.a}>Add products →</a></p>
      ) : (
        <div style={S.cols}>
          <section style={S.now}>
            <div style={S.photo}>
              {photos[picAt] && (
                // eslint-disable-next-line @next/next/no-img-element -- Blob URL from the shop, owner-only page
                <img src={photos[picAt]} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              )}
              {item.soldAt && <span style={S.sold}>SOLD</span>}
              {photos.length > 1 && (
                <>
                  <button type="button" aria-label="Previous photo" style={{ ...S.picArrow, left: 8 }} onClick={() => flipPic(-1)}>‹</button>
                  <button type="button" aria-label="Next photo" style={{ ...S.picArrow, right: 8 }} onClick={() => flipPic(1)}>›</button>
                  <span style={S.picCount}>{picAt + 1} / {photos.length} · ↑ ↓</span>
                </>
              )}
              {photos.length > 1 && (
                <div style={S.picStrip}>
                  {photos.map((u, k) => (
                    // eslint-disable-next-line @next/next/no-img-element -- Blob URL from the shop, owner-only page
                    <img key={u} src={u} alt="" onClick={() => setPic({ id: item.id, n: k })}
                      style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 8, cursor: "pointer", flexShrink: 0, outline: k === picAt ? "2px solid #4a90e2" : "none", opacity: k === picAt ? 1 : 0.7 }} />
                  ))}
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <h1 style={S.title}>{item.product.title}</h1>
              <div style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap", margin: "10px 0" }}>
                <span style={S.price}>{money(item.salePrice)}</span>
                {item.amazonPriceCents ? (
                  <span style={{ fontSize: 20, color: "#bcc" }}>
                    Amazon <s>{money(item.amazonPriceCents / 100)}</s>{pct ? <b style={{ color: "#2ecc71" }}> · {pct}% under</b> : null}
                    <span style={{ fontSize: 12, color: "#789" }}> ({item.amazonPriceAt ? `read ${new Date(item.amazonPriceAt).toLocaleDateString([], { month: "short", day: "numeric" })}` : "cached"} — the big screen has today&apos;s price)</span>
                  </span>
                ) : <span style={{ fontSize: 14, color: "#789" }}>no cached Amazon price — read it off the big screen</span>}
              </div>
              <div style={{ fontSize: 14, color: "#9ab", display: "flex", gap: 14, flexWrap: "wrap" }}>
                <span style={{ color: item.quantity > 1 ? "#ffd166" : "#9ab", fontWeight: 600 }}>qty {item.quantity}</span>
                {item.weightOz ? <span>⚖ {item.weightOz} oz ({(item.weightOz / 16).toFixed(1)} lb)</span> : <span style={{ color: "#f5c542" }}>⚖ no weight</span>}
                {item.lengthIn && item.widthIn && item.heightIn ? <span>📦 {item.lengthIn} × {item.widthIn} × {item.heightIn} in</span> : <span style={{ color: "#f5c542" }}>📦 no box size</span>}
                {item.tiktokListed ? <span style={{ color: "#69e0ff" }}>✓ in TikTok Shop</span> : <span style={{ color: "#f5c542" }}>not in TikTok Shop yet</span>}
                {!item.amazonUrl ? <span style={{ color: "#ff7b6b" }}>⚠ no Amazon link — big screen stays put</span>
                  : !item.amazonVerified ? <span style={{ color: "#f5c542" }}>⚠ Amazon match not verified</span> : null}
              </div>
              {item.notes && <p style={S.notes}>{item.notes}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button style={{ ...S.btn, ...S.secondary }} onClick={() => go(idx - 1)} disabled={idx === 0}>← prev</button>
                <button style={{ ...S.btn, ...S.primary, minWidth: 140 }} onClick={() => go(idx + 1)} disabled={idx >= items.length - 1}>next →</button>
                <button style={{ ...S.btn, ...(item.soldAt ? S.soldBtn : S.secondary) }} onClick={() => void toggleSold()}>{item.soldAt ? "✓ SOLD (S to undo)" : "Mark sold (S)"}</button>
                <button style={{ ...S.btn, ...S.secondary }} onClick={() => show(item.amazonUrl, true)} disabled={!item.amazonUrl}>Amazon (A)</button>
              </div>
            </div>
          </section>

          <aside style={{ flex: "1 1 280px", minWidth: 0 }}>
            <div style={S.label}>Up next</div>
            {items.slice(idx + 1, idx + 4).map((n, k) => (
              <button key={n.id} style={S.next} onClick={() => go(idx + 1 + k)}>
                <MiniThumb src={n.product.imageUrls[0]} />
                <span style={S.nextText}>{n.product.title}</span>
                <span style={{ color: "#9ab", fontSize: 13 }}>{money(n.salePrice)}</span>
              </button>
            ))}
            {idx >= items.length - 1 && <div style={{ color: "#789", fontSize: 14, padding: "6px 0" }}>That&apos;s the last one.</div>}

            <div style={{ ...S.label, marginTop: 16 }}>Jump to</div>
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

      <div style={{ marginTop: 18, maxWidth: 560 }}>
        <CamSwitcher compact />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: "#678" }}>
        → / Space / PageDown next · ← / PageUp prev · A Amazon · S sold · 1–4 cameras
      </div>
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
  wrap: { maxWidth: 1240, margin: "0 auto", padding: "14px 18px 40px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#eef", background: "#0b1220", minHeight: "100vh" },
  top: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  pos: { fontSize: 30, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  a: { color: "#8ab", fontSize: 14, textDecoration: "none" },
  banner: { background: "#5a1f1a", color: "#ffd", padding: "10px 12px", borderRadius: 10, marginBottom: 12, fontSize: 14, cursor: "pointer" },
  hint: { background: "#16233a", color: "#cde", padding: "10px 12px", borderRadius: 10, marginBottom: 12, fontSize: 14 },
  cols: { display: "flex", flexWrap: "wrap", gap: 22, alignItems: "flex-start" },
  now: { flex: "3 1 560px", minWidth: 0, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", alignItems: "start" },
  picArrow: { position: "absolute", top: "45%", transform: "translateY(-50%)", width: 48, height: 72, border: "none", borderRadius: 10, background: "rgba(5,10,20,0.6)", color: "#fff", fontSize: 32, cursor: "pointer" },
  picCount: { position: "absolute", top: 10, right: 10, fontSize: 12, color: "#fff", background: "rgba(5,10,20,0.65)", borderRadius: 8, padding: "2px 8px" },
  picStrip: { position: "absolute", left: 8, right: 8, bottom: 8, display: "flex", gap: 6, overflowX: "auto", padding: 4, background: "rgba(5,10,20,0.55)", borderRadius: 10 },
  photo: { position: "relative", aspectRatio: "1 / 1", background: "#0a0f1a", borderRadius: 14, overflow: "hidden" },
  sold: { position: "absolute", left: 12, top: 12, background: "#2ecc71", color: "#062", fontWeight: 800, borderRadius: 8, padding: "4px 10px" },
  title: { fontSize: 28, lineHeight: 1.2, margin: 0 },
  price: { fontSize: 54, fontWeight: 800, color: "#2ecc71", lineHeight: 1 },
  notes: { fontSize: 16, color: "#dfe", background: "#111a2b", borderRadius: 10, padding: "8px 10px", whiteSpace: "pre-wrap", margin: "12px 0 0" },
  btn: { fontSize: 16, fontWeight: 600, padding: "12px 16px", borderRadius: 12, border: "none", cursor: "pointer" },
  primary: { background: "#2ecc71", color: "#062" },
  secondary: { background: "#1c2940", color: "#dde" },
  soldBtn: { background: "#123222", color: "#2ecc71", border: "1px solid #2ecc71" },
  label: { fontSize: 11, color: "#8a9", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  next: { display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#111a2b", border: "none", borderRadius: 10, padding: 6, marginBottom: 6, color: "#eef", cursor: "pointer" },
  nextText: { flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 },
  jump: { maxHeight: 300, overflowY: "auto", background: "#0e1626", border: "1px solid #223", borderRadius: 10, padding: 4 },
  jumpRow: { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", borderRadius: 6, padding: "5px 6px", color: "#dde", cursor: "pointer", fontSize: 13 },
  jumpOn: { background: "#1f3a5f", color: "#fff" },
};
