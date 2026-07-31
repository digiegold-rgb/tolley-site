"use client";

import { useCallback, useEffect, useState } from "react";

// 🛍 TikTok tab — the Treasure Huals command center.
//
// Four questions, top to bottom: are we selling (sales + probation pace)?
// what's on the shelf (listings with compliance flags)? what needs shipping
// (fulfillment)? and where does the next wholesale SKU come from (suppliers)?
// Data arrives via /api/hq/tiktok-shop; the DGX scrape worker POSTs there, so
// this component stays a dumb renderer.

interface ListingRow {
  productId: string;
  tiktokShopId: string;
  title: string;
  price: number | null;
  image: string | null;
  shopStatus: string;
  ttStatus: string;
  flag: { flag: "sealed" | "open-box" | "used"; note?: string } | null;
}

interface OrderRow {
  id: string;
  externalId: string | null;
  title: string;
  salePrice: number;
  fulfillment: string;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  soldAt: string;
  net: number;
}

interface SupplierScorePayload {
  inBand: boolean;
  contribution: number;
  marginPct: number;
  grade: "strong" | "workable" | "thin" | "loser";
}

interface SupplierCard {
  id: string;
  name: string;
  type: string;
  website: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  location: string | null;
  rating: number | null;
  categories: string[];
  isActive: boolean;
  stage: string;
  moq: number | null;
  unitCost: number | null;
  targetRetail: number | null;
  notes: string;
  score: SupplierScorePayload | null;
}

interface Payload {
  summary: {
    live: number;
    drafts: number;
    reviewing: number;
    orders: number;
    gmv: number;
    net: number;
    awaitingFulfillment: number;
    lastSync: string | null;
  };
  probation: {
    matureOrders: number;
    target: number;
    pct: number;
    ordersLast7: number;
    paceLast7: number;
    paceTarget: number;
    onPace: boolean;
    daysSinceOpen: number;
  };
  listings: ListingRow[];
  orders: OrderRow[];
  suppliers: SupplierCard[];
  links: Record<string, string>;
  playbook: { title: string; detail: string }[];
}

const FLAG_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  sealed: { bg: "#e8f8ee", fg: "#0a7d32", label: "SEALED — OK" },
  "open-box": { bg: "#fff4e5", fg: "#8a5300", label: "OPEN-BOX — GRAY" },
  used: { bg: "#fdecea", fg: "#b3261e", label: "USED — DON'T SUBMIT" },
};

const STAGE_COLORS: Record<string, string> = {
  researching: "#6e6e73",
  contacted: "#8a5300",
  sampled: "#0a58c2",
  ordered: "#0a7d32",
  dead: "#b3261e",
};

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function ago(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (min < 60) return `${min}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e5ea",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const emptySupplier = {
  name: "",
  website: "",
  contactEmail: "",
  unitCost: "",
  targetRetail: "",
  moq: "",
  notes: "",
};

export function HqTiktokShop() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [form, setForm] = useState(emptySupplier);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/hq/tiktok-shop");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Payload);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSupplier = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hq/tiktok-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "supplier",
          name: form.name,
          website: form.website || undefined,
          contactEmail: form.contactEmail || undefined,
          unitCost: form.unitCost ? Number(form.unitCost) : undefined,
          targetRetail: form.targetRetail ? Number(form.targetRetail) : undefined,
          moq: form.moq ? Number(form.moq) : undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setForm(emptySupplier);
      setShowSupplierForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const setStage = async (s: SupplierCard, stage: string) => {
    await fetch("/api/hq/tiktok-shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "supplier",
        id: s.id,
        name: s.name,
        type: s.type,
        website: s.website ?? undefined,
        contactEmail: s.contactEmail ?? undefined,
        contactPhone: s.contactPhone ?? undefined,
        location: s.location ?? undefined,
        categories: s.categories,
        rating: s.rating ?? undefined,
        stage,
        moq: s.moq ?? undefined,
        unitCost: s.unitCost ?? undefined,
        targetRetail: s.targetRetail ?? undefined,
        notes: s.notes || undefined,
      }),
    });
    await load();
  };

  if (loading && !data) return <div style={{ padding: 20, color: "#6e6e73" }}>Loading TikTok Shop…</div>;
  if (error && !data) return <div style={{ padding: 20, color: "#b3261e" }}>Error: {error}</div>;
  if (!data) return null;

  const { summary, probation, listings, orders, suppliers, links, playbook } = data;
  const pending = orders.filter((o) => o.fulfillment === "pending");

  return (
    <div>
      {/* ── Sales & probation ─────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Sales &amp; probation</h3>
          <div style={{ fontSize: 12, color: "#6e6e73" }}>
            {summary.lastSync ? `synced ${ago(summary.lastSync)}` : "no automated sync yet — worker pending"}
            {" · "}
            <a href={links.orders} target="_blank" rel="noreferrer">Seller Center orders ↗</a>
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 12 }}>
          {[
            { label: "Orders", value: String(summary.orders) },
            { label: "GMV", value: usd(summary.gmv) },
            { label: "Net after fees", value: usd(summary.net) },
            { label: "Awaiting fulfillment", value: String(summary.awaitingFulfillment) },
            { label: "Pace (7d)", value: `${probation.paceLast7.toFixed(1)}/day` },
          ].map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: 11, textTransform: "uppercase", color: "#6e6e73" }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6e6e73", marginBottom: 4 }}>
            <span>
              Probation exit: {probation.matureOrders}/{probation.target} mature orders · day {probation.daysSinceOpen} of 60
            </span>
            <span style={{ color: probation.onPace ? "#0a7d32" : "#8a5300", fontWeight: 600 }}>
              {probation.onPace ? "ON PACE" : `need ~${probation.paceTarget}/day`}
            </span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "#e5e5ea", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.max(1, probation.pct * 100)}%`,
                height: "100%",
                background: probation.onPace ? "#0a7d32" : "#f0a020",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Fulfillment ───────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>Fulfillment</h3>
          <a href={links.fbt} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>FBT console ↗</a>
        </div>
        {orders.length === 0 ? (
          <p style={{ color: "#6e6e73", fontSize: 13, marginBottom: 0 }}>
            No orders yet. First sales will appear here automatically once the sync worker is live (or via manual entry).
          </p>
        ) : (
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#6e6e73", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ padding: "4px 8px" }}>Order</th>
                <th style={{ padding: "4px 8px" }}>Item</th>
                <th style={{ padding: "4px 8px" }}>Price</th>
                <th style={{ padding: "4px 8px" }}>Net</th>
                <th style={{ padding: "4px 8px" }}>Status</th>
                <th style={{ padding: "4px 8px" }}>Tracking</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid #f0f0f2" }}>
                  <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>{o.externalId ?? o.id.slice(0, 8)}</td>
                  <td style={{ padding: "6px 8px" }}>{o.title}</td>
                  <td style={{ padding: "6px 8px" }}>{usd(o.salePrice)}</td>
                  <td style={{ padding: "6px 8px" }}>{usd(o.net)}</td>
                  <td style={{ padding: "6px 8px" }}>
                    <span
                      style={{
                        background: o.fulfillment === "pending" ? "#fff4e5" : "#e8f8ee",
                        color: o.fulfillment === "pending" ? "#8a5300" : "#0a7d32",
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {o.fulfillment.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 12 }}>
                    {o.trackingNumber ? `${o.trackingCarrier ?? ""} ${o.trackingNumber}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pending.length > 0 && (
          <p style={{ color: "#b3261e", fontSize: 12, marginTop: 8, marginBottom: 0 }}>
            {pending.length} order{pending.length > 1 ? "s" : ""} need shipping — 2-business-day dispatch, late rate must stay ≤5%.
          </p>
        )}
      </div>

      {/* ── Listings ──────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>
            Listings — {summary.live} live · {summary.drafts} draft{summary.reviewing ? ` · ${summary.reviewing} reviewing` : ""}
          </h3>
          <div style={{ fontSize: 12 }}>
            <a href={links.drafts} target="_blank" rel="noreferrer">Drafts ↗</a>
            {" · "}
            <a href={links.qualification} target="_blank" rel="noreferrer">Qualification Center ↗</a>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 10 }}>
          {listings.map((l) => {
            const fs = l.flag ? FLAG_STYLE[l.flag.flag] : null;
            return (
              <div key={l.tiktokShopId} style={{ border: "1px solid #ececf0", borderRadius: 10, padding: 10, display: "flex", gap: 10 }}>
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.image} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 52, height: 52, borderRadius: 8, background: "#f0f0f2", flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#6e6e73" }}>
                    {l.price != null ? usd(l.price) : "—"} · {l.ttStatus.toUpperCase()}
                  </div>
                  {fs && (
                    <span style={{ background: fs.bg, color: fs.fg, borderRadius: 6, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
                      {fs.label}
                    </span>
                  )}
                  {l.flag?.note && <div style={{ fontSize: 11, color: "#8a5300", marginTop: 2 }}>{l.flag.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Suppliers ─────────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>Supplier pipeline — wholesale → FBT</h3>
          <button className="tab-btn" onClick={() => setShowSupplierForm((v) => !v)}>
            {showSupplierForm ? "Cancel" : "+ Add supplier"}
          </button>
        </div>
        {showSupplierForm && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, margin: "12px 0" }}>
            {(
              [
                ["name", "Name *"],
                ["website", "Website"],
                ["contactEmail", "Contact email"],
                ["unitCost", "Landed unit cost $"],
                ["targetRetail", "Target retail $"],
                ["moq", "MOQ (units)"],
              ] as const
            ).map(([key, label]) => (
              <input
                key={key}
                placeholder={label}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{ padding: "7px 10px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 13 }}
              />
            ))}
            <input
              placeholder="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              style={{ padding: "7px 10px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 13, gridColumn: "1 / -1" }}
            />
            <button className="tab-btn active" disabled={saving} onClick={() => void saveSupplier()}>
              {saving ? "Saving…" : "Save supplier"}
            </button>
          </div>
        )}
        {suppliers.length === 0 && !showSupplierForm ? (
          <p style={{ color: "#6e6e73", fontSize: 13, marginBottom: 0 }}>
            No suppliers yet. Add candidates here (or the nightly research job will stage them) — the scorecard grades
            landed cost against the $20–30 band after TikTok&apos;s all-in take.
          </p>
        ) : (
          suppliers.map((s) => (
            <div key={s.id} style={{ borderTop: "1px solid #f0f0f2", padding: "10px 0", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {s.website ? (
                    <a href={s.website} target="_blank" rel="noreferrer">{s.name} ↗</a>
                  ) : (
                    s.name
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#6e6e73" }}>
                  {[s.contactEmail, s.location, s.moq != null ? `MOQ ${s.moq}` : null].filter(Boolean).join(" · ") || "—"}
                </div>
                {s.notes && <div style={{ fontSize: 12, color: "#6e6e73" }}>{s.notes}</div>}
              </div>
              {s.score && (
                <div style={{ fontSize: 12 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: s.score.grade === "strong" ? "#0a7d32" : s.score.grade === "workable" ? "#8a5300" : "#b3261e",
                    }}
                  >
                    {s.score.grade.toUpperCase()}
                  </span>{" "}
                  {usd(s.unitCost ?? 0)} → {usd(s.targetRetail ?? 0)} · {usd(s.score.contribution)}/unit (
                  {Math.round(s.score.marginPct * 100)}%){!s.score.inBand && " · outside $20–30 band"}
                </div>
              )}
              <select
                value={s.stage}
                onChange={(e) => void setStage(s, e.target.value)}
                style={{ padding: "4px 8px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 12, fontWeight: 700, color: STAGE_COLORS[s.stage] ?? "#1d1d1f" }}
              >
                {["researching", "contacted", "sampled", "ordered", "dead"].map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          ))
        )}
        <p style={{ fontSize: 11, color: "#6e6e73", marginTop: 10, marginBottom: 0 }}>
          Contacting suppliers stays manual by design — evaluate here, reach out yourself, log the stage.
        </p>
      </div>

      {/* ── Playbook ──────────────────────────────────────────────────── */}
      <div style={{ ...card, background: "#fafafa" }}>
        <h3 style={{ marginTop: 0 }}>Playbook</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          {playbook.map((p, i) => (
            <div key={p.title}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{i + 1}. {p.title}</div>
              <div style={{ fontSize: 12, color: "#48484d", marginTop: 4 }}>{p.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
