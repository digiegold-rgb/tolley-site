"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  api, dimsMissing, money, pctUnderAmazon,
  type Lineup, type LineupItem, type LineupSummary, type PickerProduct,
} from "./lineup-types";

// /stream/products — pick products from the shop drafts, put them in sale order, and work through the
// per-item prep worksheet (weight + box size for TikTok Shop, Amazon match check) before the stream.

const LOW_MATCH = 0.6;

export default function LineupBuilder({ initialSlug }: { initialSlug: string | null }) {
  const [lineups, setLineups] = useState<LineupSummary[] | null>(null);
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [lineup, setLineup] = useState<Lineup | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const dragId = useRef<string | null>(null);

  const fail = useCallback((e: unknown) => setErr(e instanceof Error ? e.message : "Something went wrong"), []);

  // Bump a key to refetch — the fetches live inside the effects so nothing sets state synchronously in one.
  const [listKey, setListKey] = useState(0);
  const [lineupKey, setLineupKey] = useState(0);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const j = await api<{ lineups: LineupSummary[] }>("/api/stream-lineup");
        if (stop) return;
        setLineups(j.lineups);
        setSlug((cur) => cur ?? j.lineups[0]?.slug ?? null);
      } catch (e) { if (!stop) fail(e); }
    })();
    return () => { stop = true; };
  }, [listKey, fail]);

  useEffect(() => {
    if (!slug) return;
    let stop = false;
    window.history.replaceState(null, "", `/stream/products?l=${encodeURIComponent(slug)}`);
    (async () => {
      try {
        const j = await api<{ lineup: Lineup }>(`/api/stream-lineup/${slug}`);
        if (stop) return;
        setLineup(j.lineup);
        setErr("");
      } catch (e) { if (!stop) { setLineup(null); fail(e); } }
    })();
    return () => { stop = true; };
  }, [slug, lineupKey, fail]);

  async function createLineup() {
    const name = window.prompt("Name this lineup (e.g. Friday TikTok sale). Its link will be feed-1, feed-2, …");
    if (name === null) return;
    try {
      const j = await api<{ lineup: LineupSummary }>("/api/stream-lineup", "POST", { name });
      setListKey((k) => k + 1);
      setSlug(j.lineup.slug);
    } catch (e) { fail(e); }
  }

  async function deleteLineup() {
    if (!lineup || !window.confirm(`Delete "${lineup.name}" and its worksheet data? Products are not touched.`)) return;
    try {
      await api(`/api/stream-lineup/${lineup.slug}`, "DELETE");
      setLineup(null);
      setSlug(null);
      setListKey((k) => k + 1);
    } catch (e) { fail(e); }
  }

  const replaceItem = useCallback((item: LineupItem) => {
    setLineup((l) => (l ? { ...l, items: l.items.map((i) => (i.id === item.id ? item : i)) } : l));
  }, []);

  const patchItem = useCallback(async (id: string, body: Record<string, unknown>) => {
    if (!slug) return;
    try {
      const j = await api<{ item: LineupItem }>(`/api/stream-lineup/${slug}/items/${id}`, "PATCH", body);
      replaceItem(j.item);
      setErr("");
    } catch (e) { fail(e); }
  }, [slug, replaceItem, fail]);

  async function addProduct(productId: string) {
    if (!slug) return;
    try {
      const j = await api<{ item: LineupItem; deduped?: boolean }>(`/api/stream-lineup/${slug}/items`, "POST", { productId });
      if (!j.deduped) setLineup((l) => (l ? { ...l, items: [...l.items, j.item] } : l));
    } catch (e) { fail(e); }
  }

  async function removeItem(id: string) {
    if (!slug) return;
    setLineup((l) => (l ? { ...l, items: l.items.filter((i) => i.id !== id) } : l));
    try { await api(`/api/stream-lineup/${slug}/items/${id}`, "DELETE"); } catch (e) { fail(e); setLineupKey((k) => k + 1); }
  }

  const saveOrder = useCallback(async (items: LineupItem[]) => {
    if (!slug) return;
    try { await api(`/api/stream-lineup/${slug}/items`, "PUT", { order: items.map((i) => i.id) }); } catch (e) { fail(e); setLineupKey((k) => k + 1); }
  }, [slug, fail]);

  function move(id: string, by: number) {
    if (!lineup) return;
    const items = [...lineup.items];
    const from = items.findIndex((i) => i.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= items.length) return;
    [items[from], items[to]] = [items[to], items[from]];
    setLineup({ ...lineup, items });
    void saveOrder(items);
  }

  function dragOver(overId: string) {
    const id = dragId.current;
    if (!id || id === overId) return;
    setLineup((l) => {
      if (!l) return l;
      const items = [...l.items];
      const from = items.findIndex((i) => i.id === id);
      const to = items.findIndex((i) => i.id === overId);
      if (from < 0 || to < 0) return l;
      items.splice(to, 0, items.splice(from, 1)[0]);
      return { ...l, items };
    });
  }

  const counts = useMemo(() => {
    const items = lineup?.items ?? [];
    return {
      n: items.length,
      verified: items.filter((i) => i.amazonVerified).length,
      tiktok: items.filter((i) => i.tiktokListed).length,
      noDims: items.filter(dimsMissing).length,
      noAmazon: items.filter((i) => !i.amazonUrl).length,
    };
  }, [lineup]);

  const inLineup = useMemo(() => new Set(lineup?.items.map((i) => i.productId) ?? []), [lineup]);

  return (
    <main style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <h1 style={S.h1}>🛒 Stream lineups</h1>
        <Link href="/stream" style={S.a}>📡 back to Stream</Link>
      </div>

      {err && <div style={S.banner} onClick={() => setErr("")}>{err}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {lineups?.map((l) => (
          <button key={l.slug} onClick={() => { setOpen(null); setSlug(l.slug); }} style={{ ...S.chip, ...(l.slug === slug ? S.chipOn : {}) }}>
            {l.active ? "● " : ""}{l.name} <span style={{ color: "#89a" }}>· {l.slug} · {l.slug === slug && lineup ? lineup.items.length : l.itemCount}</span>
          </button>
        ))}
        <button onClick={() => void createLineup()} style={{ ...S.chip, borderStyle: "dashed" }}>+ new lineup</button>
      </div>

      {lineups && lineups.length === 0 && (
        <p style={{ color: "#9aa" }}>No lineups yet. Create one — the first is <code>feed-1</code>, and its clicker lives at <code>/stream/products/feed-1</code>.</p>
      )}

      {lineup && (
        <div style={S.cols}>
          {/* ── the lineup, in sale order ── */}
          <section style={{ minWidth: 0 }}>
            <div style={S.bar}>
              <div style={{ fontSize: 13, color: "#bcc", display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>{counts.n} items</span>
                <span style={{ color: counts.verified === counts.n ? "#2ecc71" : "#f5c542" }}>Amazon verified {counts.verified}/{counts.n}</span>
                <span style={{ color: counts.tiktok === counts.n ? "#2ecc71" : "#bcc" }}>TikTok-listed {counts.tiktok}/{counts.n}</span>
                <span style={{ color: counts.noDims ? "#f5c542" : "#2ecc71" }}>missing weight/size {counts.noDims}</span>
                {counts.noAmazon > 0 && <span style={{ color: "#ff7b6b" }}>no Amazon link {counts.noAmazon}</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`/stream/products/${lineup.slug}`} style={{ ...S.btn, ...S.primary, textDecoration: "none" }}>▶ Open clicker</a>
                <button onClick={() => void deleteLineup()} style={{ ...S.btn, ...S.secondary }}>Delete</button>
              </div>
            </div>

            {lineup.items.length === 0 && <p style={{ color: "#9aa" }}>Empty. Tap products on the right to add them in the order you&apos;ll sell them.</p>}

            {lineup.items.map((item, idx) => (
              <div
                key={item.id}
                style={{ ...S.row, ...(item.soldAt ? { opacity: 0.55 } : {}) }}
                onDragOver={(e) => { e.preventDefault(); dragOver(item.id); }}
                onDrop={(e) => e.preventDefault()}
              >
                <div style={S.rowHead}>
                  <span
                    draggable
                    onDragStart={(e) => { dragId.current = item.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); }}
                    onDragEnd={() => { dragId.current = null; if (lineup) void saveOrder(lineup.items); }}
                    style={S.grip}
                    title="Drag to reorder"
                  >⠿</span>
                  <span style={S.idx}>{idx + 1}</span>
                  <Thumb src={item.product.imageUrls[0]} size={48} />
                  <button style={S.titleBtn} onClick={() => setOpen(open === item.id ? null : item.id)}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product.title}</div>
                    <div style={{ fontSize: 12, color: "#9ab", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span>{money(item.salePrice)}</span>
                      {item.amazonPriceCents ? <span>Amazon {money(item.amazonPriceCents / 100)}</span> : null}
                      <Flags item={item} />
                    </div>
                  </button>
                  <button style={S.icon} onClick={() => move(item.id, -1)} disabled={idx === 0} aria-label="Move up">▲</button>
                  <button style={S.icon} onClick={() => move(item.id, 1)} disabled={idx === lineup.items.length - 1} aria-label="Move down">▼</button>
                  <button style={S.icon} onClick={() => void removeItem(item.id)} aria-label="Remove from lineup">✕</button>
                </div>
                {open === item.id && <Worksheet slug={lineup.slug} item={item} patch={patchItem} replace={replaceItem} fail={fail} />}
              </div>
            ))}
          </section>

          {/* ── product picker ── */}
          <Picker slug={lineup.slug} inLineup={inLineup} onAdd={addProduct} fail={fail} />
        </div>
      )}
    </main>
  );
}

function Flags({ item }: { item: LineupItem }) {
  const score = item.product.asinMatchScore;
  return (
    <>
      {!item.amazonUrl ? <span style={{ color: "#ff7b6b" }}>⚠ no Amazon link</span>
        : item.amazonVerified ? <span style={{ color: "#2ecc71" }}>✓ Amazon</span>
        : <span style={{ color: score !== null && score < LOW_MATCH ? "#ff9f43" : "#f5c542" }}>
            ⚠ check Amazon match{score !== null ? ` (${score.toFixed(2)})` : ""}
          </span>}
      {item.tiktokListed && <span style={{ color: "#69e0ff" }}>✓ TikTok</span>}
      {dimsMissing(item) && <span style={{ color: "#f5c542" }}>⚖ weight/size</span>}
      {item.soldAt && <span style={{ color: "#2ecc71" }}>SOLD</span>}
    </>
  );
}

function Thumb({ src, size }: { src?: string | null; size: number }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element -- Blob URLs from the shop; plain thumbnails, owner-only page
    ? <img src={src} alt="" loading="lazy" style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "#0a0f1a" }} />
    : <div style={{ width: size, height: size, borderRadius: 8, background: "#0a0f1a", flexShrink: 0 }} />;
}

function CopyRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.label}>{label}</div>
        <div style={{ fontSize: 14, whiteSpace: multiline ? "pre-wrap" : "normal", maxHeight: multiline ? 160 : undefined, overflowY: multiline ? "auto" : undefined, wordBreak: "break-word" }}>
          {value || <span style={{ color: "#667" }}>—</span>}
        </div>
      </div>
      <button
        style={{ ...S.btn, ...S.secondary, padding: "6px 10px", fontSize: 13 }}
        disabled={!value}
        onClick={() => { void navigator.clipboard.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200); }); }}
      >
        {copied ? "✓ copied" : "📋 copy"}
      </button>
    </div>
  );
}

function Worksheet({ slug, item, patch, replace, fail }: {
  slug: string;
  item: LineupItem;
  patch: (id: string, body: Record<string, unknown>) => Promise<void>;
  replace: (item: LineupItem) => void;
  fail: (e: unknown) => void;
}) {
  const p = item.product;
  const pct = pctUnderAmazon(item.salePrice, item.amazonPriceCents);

  function numField(label: string, field: "weightOz" | "lengthIn" | "widthIn" | "heightIn" | "salePrice", unit: string) {
    return (
      <label style={{ display: "grid", gap: 2, fontSize: 12, color: "#9ab" }}>
        {label}
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            key={`${field}-${item[field] ?? ""}`}
            type="number" inputMode="decimal" min={0} step={field === "weightOz" ? 1 : 0.01}
            defaultValue={item[field] ?? ""}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim();
              if (v === String(item[field] ?? "")) return;
              void patch(item.id, { [field]: v === "" ? null : Number(v) });
            }}
            style={{ ...S.input, width: 84 }}
          />
          <span>{unit}</span>
        </span>
      </label>
    );
  }

  async function setAmazon(form: HTMLFormElement) {
    const input = form.elements.namedItem("amz") as HTMLInputElement;
    const url = input.value.trim();
    if (!url) return;
    try {
      const j = await api<{ item: LineupItem }>(`/api/stream-lineup/${slug}/items/${item.id}/amazon-url`, "POST", { url });
      replace(j.item);
      form.reset();
    } catch (e) { fail(e); }
  }

  return (
    <div style={S.sheet}>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {p.imageUrls.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" title="Open full size"><Thumb src={u} size={92} /></a>
        ))}
      </div>

      <CopyRow label="Title" value={p.title} />
      <CopyRow label="Description" value={p.description ?? ""} multiline />
      <CopyRow label="Price" value={item.salePrice !== null ? String(item.salePrice) : ""} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {numField("Sale price", "salePrice", "$")}
        {numField("Weight", "weightOz", "oz")}
        {numField("Length", "lengthIn", "in")}
        {numField("Width", "widthIn", "in")}
        {numField("Height", "heightIn", "in")}
        {item.weightOz ? <span style={{ fontSize: 12, color: "#9ab", paddingBottom: 8 }}>= {(item.weightOz / 16).toFixed(2)} lb</span> : null}
      </div>

      <div style={S.amz}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={S.label}>Amazon</span>
          {item.amazonUrl
            ? <a href={item.amazonUrl} target="_blank" rel="noreferrer" style={S.a}>{item.amazonUrl.replace("https://www.", "")} ↗</a>
            : <span style={{ color: "#ff7b6b", fontSize: 14 }}>No Amazon link yet — paste one below</span>}
          {item.amazonPriceCents ? <span style={{ fontSize: 13, color: "#bcc" }}>cached {money(item.amazonPriceCents / 100)}{pct ? ` · you're ${pct}% under` : ""}</span> : null}
          {p.asinMatchScore !== null && !item.amazonVerified && (
            <span style={{ fontSize: 12, color: p.asinMatchScore < LOW_MATCH ? "#ff9f43" : "#9ab" }}>auto-match score {p.asinMatchScore.toFixed(2)}</span>
          )}
        </div>
        <label style={S.check}>
          <input type="checkbox" checked={item.amazonVerified} disabled={!item.amazonUrl} onChange={(e) => void patch(item.id, { amazonVerified: e.target.checked })} />
          ✓ I opened it — this is the right Amazon product
        </label>
        <form onSubmit={(e) => { e.preventDefault(); void setAmazon(e.currentTarget); }} style={{ display: "flex", gap: 6 }}>
          <input name="amz" placeholder="Wrong product? Paste the right Amazon URL, a.co link or ASIN" autoComplete="off" style={{ ...S.input, flex: 1 }} />
          <button type="submit" style={{ ...S.btn, ...S.secondary, padding: "8px 12px", fontSize: 13 }}>replace</button>
        </form>
      </div>

      <label style={S.check}>
        <input type="checkbox" checked={item.tiktokListed} onChange={(e) => void patch(item.id, { tiktokListed: e.target.checked })} />
        ✓ Added to TikTok Shop
      </label>

      <label style={{ display: "grid", gap: 2, fontSize: 12, color: "#9ab" }}>
        Notes (talking points, flaws, bundle ideas)
        <textarea
          key={`notes-${item.id}`}
          defaultValue={item.notes ?? ""}
          rows={2}
          onBlur={(e) => { if (e.currentTarget.value !== (item.notes ?? "")) void patch(item.id, { notes: e.currentTarget.value }); }}
          style={{ ...S.input, resize: "vertical", fontFamily: "inherit" }}
        />
      </label>
    </div>
  );
}

function Picker({ slug, inLineup, onAdd, fail }: {
  slug: string;
  inLineup: Set<string>;
  onAdd: (productId: string) => Promise<void>;
  fail: (e: unknown) => void;
}) {
  const [q, setQ] = useState("");
  const [hasAsin, setHasAsin] = useState(false);
  const [page, setPage] = useState(0);
  const [res, setRes] = useState<{ products: PickerProduct[]; total: number; pages: number } | null>(null);
  const [adding, setAdding] = useState("");

  useEffect(() => {
    let stale = false;
    const t = window.setTimeout(async () => {
      try {
        const sp = new URLSearchParams({ page: String(page), lineup: slug });
        if (q.trim()) sp.set("q", q.trim());
        if (hasAsin) sp.set("hasAsin", "1");
        const j = await api<{ products: PickerProduct[]; total: number; pages: number }>(`/api/stream-lineup/products?${sp}`);
        if (!stale) setRes(j);
      } catch (e) { if (!stale) fail(e); }
    }, 250);
    return () => { stale = true; window.clearTimeout(t); };
  }, [q, hasAsin, page, slug, fail]);

  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ ...S.bar, position: "sticky", top: 0, zIndex: 2 }}>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search drafts + listed products…" style={{ ...S.input, flex: 1, minWidth: 160 }} />
        <label style={{ ...S.check, whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={hasAsin} onChange={(e) => { setHasAsin(e.target.checked); setPage(0); }} /> has Amazon match
        </label>
      </div>
      <div style={{ fontSize: 12, color: "#89a", margin: "0 0 6px" }}>{res ? `${res.total} products · newest first · tap to add to the end` : "Loading…"}</div>
      {res?.products.map((p) => {
        const added = inLineup.has(p.id);
        return (
          <button key={p.id} disabled={added || adding === p.id} style={{ ...S.pick, opacity: added ? 0.4 : 1 }}
            onClick={async () => { setAdding(p.id); await onAdd(p.id); setAdding(""); }}>
            <Thumb src={p.thumb} size={44} />
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 14 }}>{p.title}</span>
              <span style={{ fontSize: 12, color: "#9ab" }}>
                {money(p.targetPrice ?? p.minPrice ?? p.aiSuggestedPrice)} · {p.status}
                {p.amazonAsin ? "" : " · no Amazon match"}
              </span>
            </span>
            <span style={{ fontSize: 18, color: added ? "#2ecc71" : "#8ab" }}>{added ? "✓" : "+"}</span>
          </button>
        );
      })}
      {res && res.pages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 13, color: "#9ab" }}>
          <button style={{ ...S.btn, ...S.secondary, padding: "6px 12px" }} disabled={page === 0} onClick={() => setPage((n) => n - 1)}>← newer</button>
          <span>page {page + 1} / {res.pages}</span>
          <button style={{ ...S.btn, ...S.secondary, padding: "6px 12px" }} disabled={page >= res.pages - 1} onClick={() => setPage((n) => n + 1)}>older →</button>
        </div>
      )}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 1240, margin: "0 auto", padding: "16px 16px 60px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#eef", background: "#0b1220", minHeight: "100vh" },
  h1: { fontSize: 22, margin: "6px 0 14px" },
  a: { color: "#8ab", fontSize: 14, textDecoration: "none" },
  banner: { background: "#5a1f1a", color: "#ffd", padding: "10px 12px", borderRadius: 10, marginBottom: 12, fontSize: 14, cursor: "pointer" },
  chip: { padding: "10px 12px", borderRadius: 10, border: "1px solid #334", background: "#111a2b", color: "#dde", fontSize: 14, cursor: "pointer" },
  chipOn: { background: "#1f3a5f", borderColor: "#4a90e2", color: "#fff" },
  cols: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 20, alignItems: "start" },
  bar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#0b1220", padding: "6px 0 10px" },
  btn: { fontSize: 14, fontWeight: 600, padding: "10px 14px", borderRadius: 10, border: "none", cursor: "pointer" },
  primary: { background: "#2ecc71", color: "#062" },
  secondary: { background: "#1c2940", color: "#dde" },
  row: { background: "#111a2b", borderRadius: 12, marginBottom: 8, overflow: "hidden" },
  rowHead: { display: "flex", alignItems: "center", gap: 8, padding: 8 },
  grip: { cursor: "grab", color: "#667", fontSize: 18, padding: "0 2px", userSelect: "none" },
  idx: { width: 26, textAlign: "right", color: "#89a", fontVariantNumeric: "tabular-nums", fontSize: 14 },
  titleBtn: { flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", color: "#eef", cursor: "pointer", padding: 0, fontSize: 14 },
  icon: { background: "#0e1626", border: "1px solid #223", color: "#bcc", borderRadius: 8, width: 32, height: 32, cursor: "pointer", flexShrink: 0 },
  sheet: { display: "grid", gap: 12, padding: "10px 12px 14px", borderTop: "1px solid #1c2940", background: "#0e1626" },
  label: { fontSize: 11, color: "#8a9", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { fontSize: 14, padding: 8, borderRadius: 8, border: "1px solid #334", background: "#111a2b", color: "#eef" },
  amz: { display: "grid", gap: 8, padding: 10, borderRadius: 10, border: "1px solid #223", background: "#0b1220" },
  check: { display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#dde", cursor: "pointer" },
  pick: { display: "flex", alignItems: "center", gap: 10, width: "100%", background: "#111a2b", border: "none", borderRadius: 10, padding: 6, marginBottom: 6, color: "#eef", cursor: "pointer" },
};
