"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  dealState,
  landedCost,
  SOURCES,
  type ReceiptRow,
} from "@/lib/stock/core";
import type { dashboard } from "@/lib/stock/service";
import "./stock.css";

type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
type Data = Json<Awaited<ReturnType<typeof dashboard>>>;
type Deal = Data["deals"][number];
type Purchase = Data["purchases"][number];
type Product = Purchase["lot"]["products"][number];
const dollars = (n: number | null | undefined) =>
  n == null
    ? "Unknown"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(n / 100);
const date = (s: string | null) =>
  s ? new Date(s).toLocaleString() : "Not provided";
const cents = (f: FormData, key: string) =>
  String(f.get(key) ?? "").trim() === ""
    ? null
    : Math.round(Number(f.get(key)) * 100);
const value = (n: number | null | undefined) =>
  n == null ? "" : (n / 100).toFixed(2);
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="stock-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Money({
  name,
  label,
  amount,
  required = false,
}: {
  name: string;
  label: string;
  amount?: number | null;
  required?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        name={name}
        type="number"
        min="0"
        step="0.01"
        defaultValue={value(amount)}
        required={required}
        placeholder="Unknown"
      />
    </Field>
  );
}

export default function Stock() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState("Deals");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Deal | "new" | null>(null);
  const [buying, setBuying] = useState<Deal | null>(null);
  const [receiving, setReceiving] = useState<Purchase | null>(null);
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [selling, setSelling] = useState<Product | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/stock/dashboard", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok)
      throw new Error(
        r.status === 401
          ? "Sign in with the owner account and MFA to view stock."
          : j.error,
      );
    setData(j);
  }, []);
  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  async function action(path: string, body: unknown, message = "Saved") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(
        path.startsWith("/") ? path : `/api/stock/${path}`,
        {
          method: "POST",
          headers:
            body instanceof FormData
              ? undefined
              : { "Content-Type": "application/json" },
          body: body instanceof FormData ? body : JSON.stringify(body),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Request failed");
      await refresh();
      if (j.status === "error")
        throw new Error(j.error || "Import failed; see import history");
      setNotice(
        j.status === "review"
          ? "Import saved for review: no direct listing links were found."
          : message,
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const prior = editing === "new" ? null : editing;
    const str = (k: string) => String(f.get(k) || "");
    const body = {
      ...prior,
      sourceUrl: str("sourceUrl"),
      title: str("title"),
      supplier: str("supplier"),
      category: str("category"),
      condition: str("condition"),
      location: str("location") || null,
      quantity: str("quantity") ? Number(str("quantity")) : null,
      distanceMiles: str("distanceMiles") ? Number(str("distanceMiles")) : null,
      pickup: str("pickup") === "unknown" ? null : str("pickup") === "yes",
      parcel: f.get("parcel") === "on",
      watched: f.get("watched") === "on",
      bidCents: cents(f, "bid"),
      feesCents: cents(f, "fees"),
      freightCents: cents(f, "freight"),
      resaleCents: cents(f, "resale"),
      resaleEvidence: str("resaleEvidence") || null,
      notes: str("notes") || null,
      endsAt: str("endsAt") ? new Date(str("endsAt")).toISOString() : null,
      historical: f.get("historical") === "on",
      observedAt: str("observedAt")
        ? new Date(str("observedAt")).toISOString()
        : new Date().toISOString(),
    };
    if (await action("deals", body)) setEditing(null);
  }
  function openReceipt(p: Purchase) {
    setReceiving(p);
    const manifest = p.opportunity.manifest as
      { title: string; quantity: number }[] | null;
    setRows(
      p.receipt
        ? (p.receipt as ReceiptRow[])
        : manifest?.length
          ? manifest.map((r) => ({
              title: r.title,
              category: p.opportunity.category,
              condition: p.opportunity.condition,
              expected: r.quantity,
              good: 0,
              damaged: 0,
            }))
          : [
              {
                title: p.opportunity.title,
                category: p.opportunity.category,
                condition: p.opportunity.condition,
                expected: p.opportunity.quantity || 1,
                good: 0,
                damaged: 0,
              },
            ],
    );
  }
  const deals =
    data?.deals.filter((d) => {
      if (
        !`${d.title} ${d.supplier} ${d.category} ${d.location || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      if (all) return true;
      const total = landedCost(d);
      return (
        !d.historical &&
        dealState(d) !== "Ended" &&
        (total === null
          ? (d.bidCents ?? 0) + (d.feesCents ?? 0) + (d.freightCents ?? 0) <=
            50000
          : total <= 50000) &&
        (d.parcel || d.distanceMiles === null || d.distanceMiles <= 50)
      );
    }) || [];
  const products =
    data?.purchases.flatMap((p) =>
      p.lot.products.map((v) => ({ ...v, lotName: p.lot.name })),
    ) || [];
  const remaining = Math.max(0, 50000 - (data?.spentCents || 0));
  return (
    <main className="stock-app">
      <header className="stock-header">
        <div>
          <Link href="/stream">← Stream</Link>
          <p className="stock-eyebrow">TOLLEY · SOURCING & INVENTORY</p>
          <h1>Stock for the next show.</h1>
          <p>Find a small lot. Know its cost. Learn what sells.</p>
        </div>
        <button onClick={() => setEditing("new")}>+ Add a deal</button>
      </header>
      <section className="stock-stats">
        <article>
          <span>Trial budget remaining</span>
          <strong>{dollars(remaining)}</strong>
          <small>{dollars(data?.spentCents || 0)} recorded / $500 total</small>
        </article>
        <article>
          <span>Merchandise target</span>
          <strong>$350</strong>
          <small>Reserve $150 for fees, transport & supplies</small>
        </article>
        <article>
          <span>Ready to sell</span>
          <strong>{products.filter((p) => p.status !== "sold").length}</strong>
          <small>Received and inspected units</small>
        </article>
        <article>
          <span>Pickup area</span>
          <strong>KC · 50 mi</strong>
          <small>Truck / trailer · pickup must be confirmed</small>
        </article>
      </section>
      {error && (
        <p role="alert" className="stock-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="stock-notice">
          {notice}
        </p>
      )}
      <nav className="stock-tabs" aria-label="Stock sections">
        {[
          "Deals",
          "Purchased lots",
          "Show inventory",
          "Results",
          "Imports & sources",
        ].map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {!data && !error && <p>Loading your stock…</p>}
      {data && tab === "Deals" && (
        <>
          <div className="stock-toolbar">
            <input
              aria-label="Search deals"
              placeholder="Search category, supplier or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={all}
                onChange={(e) => setAll(e.target.checked)}
              />{" "}
              Include over-budget, distant & ended lots
            </label>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => refresh().catch((e) => setError(e.message))}
            >
              Refresh
            </button>
          </div>
          <p className="stock-muted">
            Start with tools, compact home goods, sealed toys, and accessories.
            Unverified deals stay visible for review; unknown costs are never
            treated as zero.
          </p>
          <div className="stock-grid">
            {deals.map((d) => (
              <article className="stock-card" key={d.id}>
                <div className="stock-row">
                  <span className="stock-badge">{d.category}</span>
                  <button
                    className="stock-watch"
                    aria-label={d.watched ? "Unwatch deal" : "Watch deal"}
                    disabled={busy}
                    onClick={() =>
                      action(`deals/${d.id}/watch`, { watched: !d.watched })
                    }
                  >
                    {d.watched ? "★ Watching" : "☆ Watch"}
                  </button>
                </div>
                <h2>{d.title}</h2>
                <p>
                  {d.supplier} · {d.condition}
                </p>
                <p>
                  {d.location || "Location unknown"}
                  {d.distanceMiles !== null ? ` · ${d.distanceMiles} mi` : ""}
                </p>
                <p className="stock-muted">
                  {d.pickup === true
                    ? "Pickup confirmed"
                    : d.pickup === false
                      ? "Shipping required"
                      : "Pickup unconfirmed"}
                  {d.parcel ? " · Parcel shipping" : ""} · {d.quantity ?? "?"}{" "}
                  units
                </p>
                <dl>
                  <div>
                    <dt>Bid to evaluate</dt>
                    <dd>{dollars(d.bidCents)}</dd>
                  </div>
                  <div>
                    <dt>Fees / tax</dt>
                    <dd>{dollars(d.feesCents)}</dd>
                  </div>
                  <div>
                    <dt>Freight / pickup cost</dt>
                    <dd>{dollars(d.freightCents)}</dd>
                  </div>
                  <div className="stock-total">
                    <dt>Estimated landed cost</dt>
                    <dd>{dollars(landedCost(d))}</dd>
                  </div>
                </dl>
                <p>
                  {dealState(d)} · {date(d.observedAt)}
                </p>
                <p className="stock-muted">Ends: {date(d.endsAt)}</p>
                {d.resaleCents !== null && (
                  <p>
                    Resale estimate: {dollars(d.resaleCents)}
                    <small className="stock-muted">
                      {d.resaleEvidence ||
                        "No evidence supplied — low confidence"}
                    </small>
                  </p>
                )}
                {d.manifest && <p className="stock-badge">Manifest attached</p>}
                <div className="stock-actions">
                  <a href={d.sourceUrl} target="_blank" rel="noreferrer">
                    Open supplier ↗
                  </a>
                  <button className="secondary" onClick={() => setEditing(d)}>
                    Details / edit
                  </button>
                  <button
                    disabled={
                      busy ||
                      data.purchases.some((p) => p.opportunityId === d.id)
                    }
                    onClick={() => setBuying(d)}
                  >
                    {data.purchases.some((p) => p.opportunityId === d.id)
                      ? "Recorded"
                      : "Record purchase"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!deals.length && (
            <div className="stock-empty">
              <h2>Your next lot starts here.</h2>
              <p>
                Import a supplier email or add a listing. Use small local lots
                to test what your audience buys.
              </p>
              <button onClick={() => setTab("Imports & sources")}>
                Import supplier alerts
              </button>
            </div>
          )}
        </>
      )}
      {data && tab === "Purchased lots" && (
        <div className="stock-grid">
          {data.purchases.map((p) => (
            <article className="stock-card" key={p.id}>
              <span className="stock-badge">{p.status}</span>
              <h2>{p.lot.name}</h2>
              <strong className="stock-price">{dollars(p.totalCents)}</strong>
              <p>
                {p.results.sold} sold · {p.results.remaining} unsold
              </p>
              <p>Damaged inventory cost: {dollars(p.writeoffCents)}</p>
              {p.finalizedAt ? (
                <p className="stock-muted">
                  Finalized {date(p.finalizedAt)}. Products are available under
                  Show inventory.
                </p>
              ) : (
                <button onClick={() => openReceipt(p)}>
                  Receive & inspect
                </button>
              )}
            </article>
          ))}
          {!data.purchases.length && (
            <p className="stock-empty">
              Record a completed supplier purchase from a deal to begin tracking
              it.
            </p>
          )}
        </div>
      )}
      {data && tab === "Show inventory" && (
        <>
          <p className="stock-muted">
            Each row is one received unit. Add photos and pricing in the
            existing product workspace, then choose a show lineup.
          </p>
          <Link href="/stream/products">Manage show lineups →</Link>
          <div className="stock-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product / lot</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Show</th>
                  <th>Sale</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.title}</strong>
                      <small>{p.lotName}</small>
                    </td>
                    <td>{dollars(Math.round((p.totalCogs || 0) * 100))}</td>
                    <td>{p.status}</td>
                    <td>
                      <select
                        aria-label={`Show for ${p.title}`}
                        defaultValue=""
                        disabled={busy || p.status === "sold"}
                        onChange={(e) => {
                          if (e.target.value)
                            void action(
                              `/api/stream-lineup/${e.target.value}/items`,
                              { productId: p.id },
                              "Added to show lineup",
                            );
                          e.target.value = "";
                        }}
                      >
                        <option value="">Add to lineup…</option>
                        {data.lineups.map((l) => (
                          <option
                            key={l.id}
                            value={l.slug}
                            disabled={p.streamLineupItems.some(
                              (i) => i.lineupId === l.id,
                            )}
                          >
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        disabled={p.status === "sold"}
                        onClick={() => setSelling(p)}
                      >
                        Record sale
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!products.length && (
            <p className="stock-empty">
              Finalize a received lot to create its sellable units.
            </p>
          )}
        </>
      )}
      {data && tab === "Results" && (
        <>
          <div className="stock-grid">
            {data.categories.map((c) => (
              <article className="stock-card" key={c.category}>
                <h2>{c.category}</h2>
                <strong className="stock-price">
                  {c.received ? Math.round((c.sold / c.received) * 100) : 0}%
                  sold
                </strong>
                <p>
                  {c.sold} of {c.received} received sellable units
                </p>
                <p>
                  Sold-unit profit:{" "}
                  {dollars(c.incompleteCosts ? null : c.profitCents)}
                </p>
                <small>
                  {c.sold < 10
                    ? "Early trial — too few sales to establish demand."
                    : "Compare profit and sell-through before buying more."}
                </small>
              </article>
            ))}
          </div>
          <p>
            Use actual sales to choose the next category. Sold-unit profit
            excludes unsold inventory; cash recovery subtracts the entire
            purchase cost.
          </p>
          <div className="stock-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Lot / category</th>
                  <th>Sold / received sellable</th>
                  <th>Net sales receipts</th>
                  <th>Sold-unit profit</th>
                  <th>Whole-lot cash recovery</th>
                  <th>Write-offs</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.lot.name}
                      <small>{p.opportunity.category}</small>
                    </td>
                    <td>
                      {p.results.sold} / {p.lot.products.length}
                    </td>
                    <td>{dollars(p.results.netReceiptsCents)}</td>
                    <td>{dollars(p.results.soldProfitCents)}</td>
                    <td>{dollars(p.results.cashRecoveryCents)}</td>
                    <td>{dollars(p.writeoffCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="stock-muted">
            Unknown means a sale is missing costs. Manufacturer retail values
            are not sales revenue.
          </p>
        </>
      )}
      {data && tab === "Imports & sources" && (
        <>
          <div className="stock-grid">
            <article className="stock-card">
              <h2>Import a manifest or email</h2>
              <p>
                CSV / XLSX up to 1,000 rows; TXT / EML email. Maximum 2 MB. Add
                the deal first to attach a manifest.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(
                    "imports",
                    new FormData(e.currentTarget),
                    "Import processed — see history below",
                  );
                }}
              >
                <Field label="Listing URL (required for a manifest)">
                  <input
                    name="sourceUrl"
                    type="url"
                    placeholder="https://bstock.com/buy/listings/details/…"
                  />
                </Field>
                <Field label="File">
                  <input
                    type="file"
                    name="file"
                    accept=".csv,.xlsx,.txt,.eml"
                    required
                  />
                </Field>
                <button disabled={busy}>Import file</button>
              </form>
              <details>
                <summary>Paste an email instead</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void action(
                      "imports",
                      { text: f.get("text") },
                      "Email processed",
                    );
                  }}
                >
                  <textarea
                    name="text"
                    aria-label="Supplier email text"
                    rows={6}
                    required
                  />
                  <button disabled={busy}>Import email</button>
                </form>
              </details>
            </article>
            <article className="stock-card">
              <h2>Collection health</h2>
              <p>
                Supplier email is checked every 15 minutes. Watched B-Stock
                listings refresh hourly when the browser session is available.
              </p>
              {data.intakeAddress && (
                <p>
                  Forward selected supplier alerts to{" "}
                  <strong>{data.intakeAddress}</strong>.
                </p>
              )}
              {["mail", "browser", "imports"].map((id) => {
                const s = data.sync.find((s) => s.id === id);
                const stale =
                  !s ||
                  Date.now() - new Date(s.checkedAt).getTime() >
                    (id === "browser" ? 2 : 1) * 3600000;
                return (
                  <p key={id}>
                    <strong>
                      {id}: {s ? (stale ? "Stale" : s.status) : "Not connected"}
                    </strong>
                    <small>
                      {s
                        ? `${s.message || ""} · ${date(s.checkedAt)}`
                        : "Awaiting first successful run"}
                    </small>
                  </p>
                );
              })}
            </article>
          </div>
          <div className="stock-grid">
            {SOURCES.map((s) => (
              <article className="stock-card" key={s.name}>
                <h2>{s.name}</h2>
                <p>{s.note}</p>
                <a href={s.url} target="_blank" rel="noreferrer">
                  Browse supplier ↗
                </a>
              </article>
            ))}
          </div>
          <h2>Import history</h2>
          <div className="stock-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Import</th>
                  <th>Status</th>
                  <th>Rows / links</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {data.imports.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.name}
                      <small>{date(i.createdAt)}</small>
                    </td>
                    <td>
                      {i.status}
                      <small>{i.error}</small>
                    </td>
                    <td>{i.resultCount}</td>
                    <td>
                      <button
                        className="secondary"
                        onClick={async () => {
                          try {
                            const r = await fetch(`/api/stock/imports/${i.id}`);
                            const j = await r.json();
                            if (!r.ok) throw new Error(j.error);
                            setReview(JSON.stringify(j.payload, null, 2));
                          } catch (e) {
                            setError(String(e));
                          }
                        }}
                      >
                        Review
                      </button>
                      {["error", "review"].includes(i.status) && (
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => action("imports/retry", { id: i.id })}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {editing && (
        <div className="stock-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Deal details"
            className="stock-modal"
          >
            <div className="stock-row">
              <h2>
                {editing === "new"
                  ? "Add a sourcing opportunity"
                  : "Deal details"}
              </h2>
              <button className="secondary" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>
            <form onSubmit={save}>
              <DealFields deal={editing === "new" ? null : editing} />
              <button disabled={busy}>Save deal</button>
            </form>
          </section>
        </div>
      )}
      {buying && (
        <div className="stock-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Record purchase"
            className="stock-modal"
          >
            <h2>Record a completed purchase</h2>
            <p>{buying.title}</p>
            <p>
              This records inventory you already bought. It does not place a bid
              or send payment.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await action(
                    `deals/${buying.id}/purchase`,
                    { totalCents: cents(f, "total") },
                    "Purchase recorded",
                  )
                )
                  setBuying(null);
              }}
            >
              <Money
                name="total"
                label="Actual total paid, including fees, freight & tax ($)"
                amount={landedCost(buying)}
                required
              />
              <p>
                Trial budget remaining: {dollars(remaining)}. Record the actual
                amount even if it exceeds the trial budget.
              </p>
              <div className="stock-actions">
                <button disabled={busy}>Record purchase</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setBuying(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {receiving && (
        <div className="stock-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Receive inventory"
            className="stock-modal wide"
          >
            <h2>Receive & inspect</h2>
            <p>
              {receiving.lot.name} · {dollars(receiving.totalCents)} total
            </p>
            <p>
              Save cumulative counts as deliveries arrive. Finalize after
              inspection to create sellable units. Costs split equally across
              received units unless every row has a custom allocation.
            </p>
            <div className="stock-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Expected</th>
                    <th>Sellable</th>
                    <th>Damaged</th>
                    <th>Missing</th>
                    <th>Row cost $ (optional)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <input
                          aria-label={`Item ${i + 1}`}
                          value={r.title}
                          onChange={(e) =>
                            setRows(
                              rows.map((v, n) =>
                                n === i ? { ...v, title: e.target.value } : v,
                              ),
                            )
                          }
                        />
                        <input
                          aria-label={`Category ${i + 1}`}
                          placeholder="Category"
                          value={r.category}
                          onChange={(e) =>
                            setRows(
                              rows.map((v, n) =>
                                n === i
                                  ? { ...v, category: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                        <input
                          aria-label={`Condition ${i + 1}`}
                          placeholder="Condition after inspection"
                          value={r.condition}
                          onChange={(e) =>
                            setRows(
                              rows.map((v, n) =>
                                n === i
                                  ? { ...v, condition: e.target.value }
                                  : v,
                              ),
                            )
                          }
                        />
                      </td>
                      {(["expected", "good", "damaged"] as const).map((k) => (
                        <td key={k}>
                          <input
                            aria-label={`${k} ${i + 1}`}
                            type="number"
                            min="0"
                            value={r[k]}
                            onChange={(e) =>
                              setRows(
                                rows.map((v, n) =>
                                  n === i
                                    ? { ...v, [k]: Number(e.target.value) }
                                    : v,
                                ),
                              )
                            }
                          />
                        </td>
                      ))}
                      <td>{r.expected - r.good - r.damaged}</td>
                      <td>
                        <input
                          aria-label={`Allocation ${i + 1}`}
                          type="number"
                          min="0"
                          step=".01"
                          value={
                            r.allocationCents === undefined
                              ? ""
                              : r.allocationCents / 100
                          }
                          onChange={(e) =>
                            setRows(
                              rows.map((v, n) =>
                                n === i
                                  ? {
                                      ...v,
                                      allocationCents:
                                        e.target.value === ""
                                          ? undefined
                                          : Math.round(
                                              Number(e.target.value) * 100,
                                            ),
                                    }
                                  : v,
                              ),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="stock-actions">
              <button
                className="secondary"
                onClick={() =>
                  setRows([
                    ...rows,
                    {
                      title: "",
                      category: receiving.opportunity.category,
                      condition: "Inspected",
                      expected: 1,
                      good: 0,
                      damaged: 0,
                    },
                  ])
                }
              >
                Add item
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    await action(
                      `purchases/${receiving.id}/receive`,
                      { rows, stage: "received" },
                      "Receipt saved; no products created yet",
                    )
                  )
                    setReceiving(null);
                }}
              >
                Save partial receipt
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    await action(
                      `purchases/${receiving.id}/receive`,
                      { rows, stage: "inspected" },
                      "Inspection saved",
                    )
                  )
                    setReceiving(null);
                }}
              >
                Save inspection
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  if (
                    await action(
                      `purchases/${receiving.id}/receive`,
                      { rows, finalize: true },
                      "Inventory ready for show lineups",
                    )
                  ) {
                    setReceiving(null);
                    setTab("Show inventory");
                  }
                }}
              >
                Finalize inspected stock
              </button>
              <button className="secondary" onClick={() => setReceiving(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
      {selling && (
        <div className="stock-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Record sale"
            className="stock-modal"
          >
            <h2>Record sale</h2>
            <p>{selling.title}</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (
                  await action(
                    `products/${selling.id}/sale`,
                    {
                      saleCents: cents(f, "sale"),
                      feesCents: cents(f, "fees"),
                      shippingCents: cents(f, "shipping"),
                      shippingPaidCents: cents(f, "shippingPaid"),
                      platform: f.get("platform"),
                      externalId:
                        String(f.get("externalId") || "") || undefined,
                    },
                    "Sale recorded once in the shared ledger",
                  )
                )
                  setSelling(null);
              }}
            >
              <div className="stock-form-grid">
                <Money name="sale" label="Item sale price ($)" required />
                <Money
                  name="fees"
                  label="Platform / payment fees ($)"
                  required
                />
                <Money
                  name="shipping"
                  label="Shipping paid by you ($)"
                  required
                />
                <Money
                  name="shippingPaid"
                  label="Shipping collected from buyer ($)"
                  amount={0}
                  required
                />
                <Field label="Platform">
                  <input name="platform" defaultValue="whatnot" required />
                </Field>
                <Field label="Platform sale ID (optional)">
                  <input name="externalId" />
                </Field>
              </div>
              <div className="stock-actions">
                <button disabled={busy}>Record sale</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSelling(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {review && (
        <div className="stock-overlay">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Import contents"
            className="stock-modal"
          >
            <h2>Import contents</h2>
            <p>Supplier content is displayed as plain text.</p>
            <pre>{review}</pre>
            <button onClick={() => setReview(null)}>Close</button>
          </section>
        </div>
      )}
      {busy && (
        <div className="stock-saving" role="status">
          Saving…
        </div>
      )}
    </main>
  );
}
function DealFields({ deal: d }: { deal: Deal | null }) {
  const localDate = (s: string | null | undefined) => {
    if (!s) return "";
    const dt = new Date(s);
    return new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  return (
    <>
      <Field label="Supplier listing URL">
        <input
          name="sourceUrl"
          type="url"
          required
          defaultValue={d?.sourceUrl}
        />
      </Field>
      <Field label="Lot title">
        <input name="title" required defaultValue={d?.title} />
      </Field>
      <div className="stock-form-grid">
        <Field label="Supplier">
          <input
            name="supplier"
            required
            defaultValue={d?.supplier || "B-Stock"}
          />
        </Field>
        <Field label="Category">
          <input
            name="category"
            defaultValue={d?.category || "Mixed"}
            list="stock-categories"
          />
          <datalist id="stock-categories">
            {[
              "Tools",
              "Home goods",
              "Toys",
              "Accessories",
              "Clothing",
              "Mixed",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </datalist>
        </Field>
        <Field label="Condition">
          <input name="condition" defaultValue={d?.condition || "Unknown"} />
        </Field>
        <Field label="Quantity">
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue={d?.quantity || ""}
          />
        </Field>
        <Field label="Warehouse / pickup location">
          <input name="location" defaultValue={d?.location || ""} />
        </Field>
        <Field label="Distance from KC (miles)">
          <input
            name="distanceMiles"
            type="number"
            min="0"
            step=".1"
            defaultValue={d?.distanceMiles ?? ""}
          />
        </Field>
        <Field label="Pickup eligibility">
          <select
            name="pickup"
            defaultValue={
              d?.pickup === null || d?.pickup === undefined
                ? "unknown"
                : d.pickup
                  ? "yes"
                  : "no"
            }
          >
            <option value="unknown">Unconfirmed</option>
            <option value="yes">Pickup confirmed</option>
            <option value="no">Shipping required</option>
          </select>
        </Field>
        <Field label="Auction closes (local time)">
          <input
            name="endsAt"
            type="datetime-local"
            defaultValue={localDate(d?.endsAt)}
          />
        </Field>
        <Money
          name="bid"
          label="Bid / asking price to evaluate ($)"
          amount={d?.bidCents}
        />
        <Money
          name="fees"
          label="Fees and tax estimate ($)"
          amount={d?.feesCents}
        />
        <Money
          name="freight"
          label="Freight / pickup cost estimate ($)"
          amount={d?.freightCents}
        />
        <Money
          name="resale"
          label="Estimated resale proceeds ($)"
          amount={d?.resaleCents}
        />
        <Field label="Observation date (local time)">
          <input
            name="observedAt"
            type="datetime-local"
            defaultValue={localDate(d?.observedAt || new Date().toISOString())}
          />
        </Field>
      </div>
      <Field label="Resale evidence and confidence">
        <textarea
          name="resaleEvidence"
          rows={2}
          defaultValue={d?.resaleEvidence || ""}
          placeholder="Recent sold examples, expected sellable units; low / medium / high confidence"
        />
      </Field>
      <Field label="Notes / manifest summary">
        <textarea name="notes" rows={4} defaultValue={d?.notes || ""} />
      </Field>
      <div className="stock-checks">
        <label>
          <input type="checkbox" name="parcel" defaultChecked={d?.parcel} />{" "}
          Parcel shipping
        </label>
        <label>
          <input type="checkbox" name="watched" defaultChecked={d?.watched} />{" "}
          Watch this lot
        </label>
        <label>
          <input
            type="checkbox"
            name="historical"
            defaultChecked={d?.historical}
          />{" "}
          Historical research
        </label>
      </div>
    </>
  );
}
