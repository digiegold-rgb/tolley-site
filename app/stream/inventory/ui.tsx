"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import "./inventory.css";

type Stock = { blocked?: boolean; onHand: number; reserved: number; available: number; revision: number; countedAt: string | null };
type Product = { id: string; title: string; sku: string | null; status: string; imageUrls: string[]; targetPrice: number | null; inventory: Stock | null };
type Hold = { id: string; productId: string; channel: string; quantity: number; reference: string | null; note: string | null };
type Desk = { products: Product[]; reservations: Hold[]; issues: { id: string; productId: string | null; channel: string; message: string; title: string }[]; movements: { id: string; key: string; productId: string; action: string; channel: string; quantity: number; createdAt: string; title: string; reversed: boolean }[]; lineups: { id: string; slug: string; name: string }[]; shopifyConfigured: boolean; channels: {productId: string; channel: string; checkedAt: string | null}[] };

export default function InventoryDesk() {
  const [data, setData] = useState<Desk | null>(null), [query, setQuery] = useState(""), [search, setSearch] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [show, setShow] = useState("");
  const sending = useRef(false), pending = useRef<{ signature: string; key: string } | null>(null);
  const refresh = useCallback(async () => {
    const r = await fetch(`/api/shop/inventory?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    if (r.status === 401) throw new Error("Your session expired. Sign in again.");
    const j = await r.json(); if (!r.ok) throw new Error(j.error || "Could not load inventory"); setData(j);
  }, [query]);
  useEffect(() => { void refresh().catch(e => setError(e.message)); const t = setInterval(() => { if (!sending.current) void refresh().catch(e => setError(e.message)); }, 15000); return () => clearInterval(t); }, [refresh]);
  async function action(body: Record<string, unknown>, path = "/api/shop/inventory") {
    if (sending.current) return false;
    sending.current = true; setBusy(true); setError(""); setNotice("");
    const signature = JSON.stringify([path, body]);
    if (pending.current?.signature !== signature) pending.current = { signature, key: crypto.randomUUID() };
    try {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, key: pending.current.key }) });
      const j = await r.json(); if (!r.ok) { pending.current = null; throw new Error(j.error || "Could not save"); }
      pending.current = null; setNotice(j.message || "Saved. Stock and reservations updated."); await refresh(); return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Retry the same action to check its result."); return false; }
    finally { sending.current = false; setBusy(false); }
  }
  return <main className="inventory-desk">
    <nav><Link href="/stream">Stream controls</Link><Link href="/stream/products">Show lineups</Link><Link href="/shop">Your shop</Link></nav>
    <header><p className="inventory-eyebrow">YOUR STOCK · ALL SALES</p><h1>Inventory desk</h1><p>Record a sale once. Keep available units separate from units held for a buyer or tonight’s show.</p></header>
    {error && <p className="inventory-error" role="alert">{error}</p>}{notice && <p className="inventory-success" role="status">{notice}</p>}
    <section className="inventory-show"><div><h2>Nightly show · 8:30 p.m. Central</h2><p>Reserve the selected lineup before selling live. Release remaining units after the show. This does not start or stop your stream.</p></div>
      <label>Show lineup<select value={show} onChange={e => setShow(e.target.value)}><option value="">Choose a lineup</option>{data?.lineups.map(l => <option key={l.id} value={l.slug}>{l.name}</option>)}</select></label>
      <button disabled={busy || !show} onClick={() => void action({ action: "reserve" }, `/api/stream-lineup/${show}/inventory`)}>Reserve show stock</button>
      <button className="secondary" disabled={busy || !show} onClick={() => void action({ action: "release" }, `/api/stream-lineup/${show}/inventory`)}>Release unsold stock</button>
    </section>
    <div className="inventory-connections"><p><strong>Tolley shop:</strong> shared stock and checkout reservations.</p><p><strong>Facebook Marketplace:</strong> record message/cash sales here; listing updates needing confirmation appear below.</p><p><strong>Whatnot:</strong> record live sales in your lineup. CSV creates listings but does not synchronize sales. For Shopify-linked products, use the connected Whatnot listing and let stock sync automatically.</p><p><strong>Shopify:</strong> {data?.shopifyConfigured ? "Credentials configured. Link and verify products before enabling synchronization." : "Not connected. Automatic Whatnot synchronization needs an activated connection."}</p></div>
    {!!data?.issues.length && <section className="inventory-issues"><h2>Needs attention · {data.issues.length}</h2>{data.issues.map(i => <div key={i.id}><p><strong>{i.title}</strong><br />{i.message}</p><button className="secondary" disabled={busy} onClick={() => void action({ action: "resolve", id: i.id })}>I checked this</button></div>)}</section>}
    <form className="inventory-search" onSubmit={e => { e.preventDefault(); setQuery(search); }}><label>Find a product<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or SKU" /></label><button>Search</button></form>
    {!data && !error && <p>Loading inventory…</p>}
    {data && <p className="inventory-muted">Showing up to 100 products. Uncounted products start at one unit (sold items at zero); verify physical quantities before a show.</p>}
    <div className="inventory-products">{data?.products.map(p => <ProductCard key={p.id} product={p} holds={data.reservations.filter(h => h.productId === p.id)} busy={busy} action={action} shopifyConfigured={data.shopifyConfigured} linked={data.channels.some(c => c.productId === p.id && c.channel === "shopify")} />)}</div>
    {data?.products.length === 0 && <p>No products match that search.</p>}
    <section className="inventory-history"><h2>Recent stock activity</h2>{data?.movements.map(m => <div key={m.id}><span>{m.title}<small>{m.channel} · {new Date(m.createdAt).toLocaleString()}</small></span><strong>{m.action} · {m.quantity}</strong>{m.action === "sale" && !m.reversed && <button className="secondary" disabled={busy} onClick={() => void action({ productId: m.productId, action: "restore", channel: m.channel, reference: m.key, note: "Seller confirmed cancellation or return" })}>Return stock</button>}</div>)}<p className="inventory-muted">Returning stock records a correction. Refund the buyer on the original payment platform separately.</p></section>
  </main>;
}
function ProductCard({ product: p, holds, busy, action, shopifyConfigured, linked }: { product: Product; holds: Hold[]; busy: boolean; action: (body: Record<string, unknown>, path?: string) => Promise<boolean>; shopifyConfigured: boolean; linked: boolean }) {
  const initial = p.status === "sold" ? 0 : 1;
  const stock = p.inventory ?? { onHand: initial, reserved: 0, available: initial, revision: 0, countedAt: null };
  const [quantity, setQuantity] = useState(1), [price, setPrice] = useState(String(p.targetPrice ?? "")), [channel, setChannel] = useState("facebook"), [note, setNote] = useState("");
  const [countDraft, setCountDraft] = useState<{ count: string; revision: number } | null>(null);
  const count = countDraft?.count ?? String(stock.onHand), countRevision = countDraft?.revision ?? stock.revision;
  const [inventoryId, setInventoryId] = useState(""), [locationId, setLocationId] = useState("");
  return <article className="inventory-product"><h2>{p.title}</h2><p className="inventory-muted">{p.sku || p.id}</p><div className="inventory-counts"><span><b>{stock.available}</b>Available</span><span><b>{stock.reserved}</b>Reserved</span><span><b>{stock.onHand}</b>Unsold total</span></div>
    {stock.blocked && <p className="inventory-error">Sales paused: reconcile the inventory discrepancy.</p>}
    {!stock.countedAt && <p className="inventory-warning">Physical count not verified</p>}
    <form onSubmit={e => { e.preventDefault(); void action({ productId: p.id, action: "sale", channel, quantity, salePrice: price === "" ? undefined : Number(price) }); }}>
      <label>Sold on<select value={channel} onChange={e => setChannel(e.target.value)}><option value="facebook">Facebook</option><option value="whatnot">Whatnot</option><option value="other">In person / other</option></select></label>
      <label>Units<input type="number" min="1" max="100000" step="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} required /></label><label>Total received ($)<input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label>
      <button disabled={busy || stock.blocked || quantity > stock.available}>Record sale</button><button type="button" className="secondary" disabled={busy || stock.blocked || quantity > stock.available} onClick={() => void action({ productId: p.id, action: "reserve", channel, quantity, note: "Buyer hold" })}>Hold for buyer</button>
    </form>
    {holds.map(h => <div className="inventory-hold" key={h.id}><span>{h.quantity} held · {h.channel}<small>{h.note || h.reference}</small></span>{h.reference?.startsWith("checkout:") ? <small>Awaiting checkout completion or expiry</small> : <><button disabled={busy} onClick={() => void action({ productId: p.id, action: "sale", channel: h.channel, quantity: h.quantity, reservationId: h.id, salePrice: price === "" ? undefined : Number(price) })}>Complete sale</button><button className="secondary" disabled={busy} onClick={() => void action({ productId: p.id, action: "release", channel: h.channel, reservationId: h.id })}>Release</button></>}</div>)}
    {shopifyConfigured && <details><summary>{linked ? "Shopify connected" : "Link Shopify stock"}</summary>{linked ? <><button disabled={busy} onClick={() => void action({action:"catalog",productId:p.id},"/api/shop/inventory/shopify")}>Update product details</button><button disabled={busy} onClick={() => void action({action:"sync",productId:p.id},"/api/shop/inventory/shopify")}>Sync now</button>{stock.blocked && <><p>Resolve reservations, save a fresh physical count, and correct Shopify to the same quantity before resuming.</p><button disabled={busy || stock.reserved > 0} onClick={() => void action({action:"reconcile",productId:p.id},"/api/shop/inventory/shopify")}>Verify matching counts and resume</button></>}</> : <form onSubmit={e => {e.preventDefault();void action({action:"link",productId:p.id,externalId:inventoryId,locationId},"/api/shop/inventory/shopify");}}><p>Shopify SKU must be <strong>tolley-{p.id}</strong>. Counts must match before linking.</p><label>Inventory item ID<input value={inventoryId} onChange={e => setInventoryId(e.target.value)} placeholder="gid://shopify/InventoryItem/…" required /></label><label>Location ID<input value={locationId} onChange={e => setLocationId(e.target.value)} placeholder="gid://shopify/Location/…" required /></label><button disabled={busy}>Verify and link</button><button type="button" disabled={busy} onClick={() => void action({action:"catalog",productId:p.id,locationId},"/api/shop/inventory/shopify")}>Create Shopify draft</button></form>}</details>}
    <details><summary>Correct physical stock count</summary><form onSubmit={e => { e.preventDefault(); void action({ productId: p.id, action: "count", channel: "other", quantity: Number(count), expectedRevision: countRevision, note }).then(saved => { if (saved) setCountDraft(null); }); }}><label>Unsold units, including reservations<input type="number" min="0" step="1" value={count} onChange={e => { setCountDraft({count:e.target.value,revision:countRevision}); }} required /></label><label>Reason<input value={note} onChange={e => { setCountDraft({count,revision:countRevision}); setNote(e.target.value); }} required placeholder="Counted shelf / new delivery" /></label><button disabled={busy}>Save count</button><button type="button" className="secondary" disabled={busy} onClick={() => { setCountDraft(null); }}>Reset to latest count</button></form></details>
  </article>;
}
