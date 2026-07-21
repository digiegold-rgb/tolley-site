"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import {
  ESTATE_CHECKLIST_ITEMS,
  ESTATE_LEAD_STAGES,
} from "@/lib/estate-admin";
import { readApiError } from "./types";

interface EstateSaleRow {
  id: string;
  slug: string;
  title: string;
  areaLabel: string;
  address: string | null;
  addressPublishAt: string | null;
  vipNotifyAt: string | null;
  vipNotifiedAt: string | null;
  announcedAt: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  photos: string[];
  videoUrl: string | null;
  grossTotal: number | null;
  checklist: Record<string, boolean> | null;
  _count: { leads: number };
}

interface EstateLeadRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string;
  source: string;
  stage: string;
  notes: string | null;
  walkthroughAt: string | null;
  sale: { id: string; slug: string; title: string } | null;
  createdAt: string;
}

const STAGE_LABEL: Record<string, string> = {
  inquiry: "Inquiry",
  walkthrough: "Walkthrough",
  signed: "Signed",
  scheduled: "Scheduled",
  done: "Done",
  lost: "Lost",
};

function shortDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function countdown(iso: string | null): string {
  if (!iso) return "not set";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "passed";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

// Estates tab — sale cards (playbook checklist, VIP countdowns, photos,
// mark-done privacy flow), seller mini-kanban, VIP list. Self-fetching.
export function HqEstates() {
  const { toast } = useToast();
  const [sales, setSales] = useState<EstateSaleRow[]>([]);
  const [leads, setLeads] = useState<EstateLeadRow[]>([]);
  const [vipCount, setVipCount] = useState<number | null>(null);
  const [vipList, setVipList] = useState<{ email: string; createdAt: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNewSale, setShowNewSale] = useState(false);
  const [showNewLead, setShowNewLead] = useState(false);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, leadsRes, vipsRes] = await Promise.all([
        fetch("/api/hq/estate/sales"),
        fetch("/api/hq/estate/leads"),
        fetch("/api/hq/estate/vips"),
      ]);
      if (!salesRes.ok) throw new Error(await readApiError(salesRes, "Failed to load sales"));
      if (!leadsRes.ok) throw new Error(await readApiError(leadsRes, "Failed to load leads"));
      setSales((await salesRes.json()).sales);
      setLeads((await leadsRes.json()).leads);
      if (vipsRes.ok) setVipCount((await vipsRes.json()).count);
    } catch (err) {
      toast({
        title: "Failed to load estates",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function patchSale(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    setBusyId(id);
    try {
      const r = await fetch(`/api/hq/estate/sales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Update failed");
      if (d.warning) toast({ title: "Heads up", description: d.warning });
      await load();
      return true;
    } catch (err) {
      toast({
        title: "Sale update failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function markDone(sale: EstateSaleRow) {
    const grossRaw = window.prompt(
      `Exact gross total for "${sale.title}" (required to close out):`,
      sale.grossTotal != null ? String(sale.grossTotal) : "",
    );
    if (grossRaw == null) return;
    const gross = Number(grossRaw.replace(/[$,]/g, ""));
    if (!Number.isFinite(gross) || gross <= 0) {
      toast({ title: "Enter a real gross number", variant: "error" });
      return;
    }
    const sure = window.confirm(
      "Mark done? This permanently scrubs the address from the row — done sales never show an address.",
    );
    if (!sure) return;
    await patchSale(sale.id, { status: "done", grossTotal: gross, confirmDone: true });
  }

  async function setAddress(sale: EstateSaleRow) {
    const address = window.prompt(
      "Street address (saving this ARMS the VIP email blast once vipNotifyAt passes — setting it is the approval):",
      sale.address ?? "",
    );
    if (address == null) return;
    await patchSale(sale.id, { address });
  }

  async function setWhen(sale: EstateSaleRow, field: "vipNotifyAt" | "addressPublishAt") {
    const label = field === "vipNotifyAt" ? "VIP email reveal" : "public page reveal";
    const current = sale[field] ? new Date(sale[field] as string).toISOString().slice(0, 16) : "";
    const raw = window.prompt(`${label} time (YYYY-MM-DDTHH:MM, local — blank to clear):`, current);
    if (raw == null) return;
    await patchSale(sale.id, { [field]: raw.trim() ? new Date(raw).toISOString() : null });
  }

  async function uploadPhotos(sale: EstateSaleRow, files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusyId(sale.id);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append("file", f);
      const r = await fetch(`/api/hq/estate/sales/${sale.id}/photos`, {
        method: "POST",
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Upload failed");
      toast({
        title: `${d.added.length} photo${d.added.length === 1 ? "" : "s"} uploaded`,
        description:
          sale.photos.length === 0 && sale.status === "upcoming"
            ? "First photos on an upcoming sale — the announcement email arms on the next hourly cron."
            : undefined,
        variant: "success",
      });
      await load();
    } catch (err) {
      toast({
        title: "Photo upload failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function patchLead(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/hq/estate/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Update failed"));
      await load();
    } catch (err) {
      toast({
        title: "Lead update failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function createFromForm(
    e: React.FormEvent<HTMLFormElement>,
    endpoint: string,
    done: () => void,
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body: Record<string, unknown> = {};
    fd.forEach((v, k) => {
      if (typeof v === "string" && v.trim()) body[k] = v.trim();
    });
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Create failed");
      toast({ title: "Created", variant: "success" });
      form.reset();
      done();
      await load();
    } catch (err) {
      toast({
        title: "Create failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    }
  }

  const input = (name: string, placeholder: string, type = "text", required = false) => (
    <input
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
      style={{ padding: "6px 10px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 13 }}
    />
  );

  return (
    <div>
      {/* ─── Sales ─── */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>Sales</strong>
          <button
            className="btn btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={() => setShowNewSale((s) => !s)}
          >
            {showNewSale ? "Cancel" : "+ New sale"}
          </button>
          <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={load} disabled={loading}>↻</button>
        </div>

        {showNewSale && (
          <form
            onSubmit={(e) => createFromForm(e, "/api/hq/estate/sales", () => setShowNewSale(false))}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, padding: 10, background: "#fafafa", borderRadius: 8 }}
          >
            {input("title", "Title (e.g. Independence Estate Sale — Aug 14–15)", "text", true)}
            {input("slug", "slug (independence-aug-14-15)", "text", true)}
            {input("areaLabel", "Area label (Independence, MO)")}
            {input("startsAt", "Starts", "datetime-local", true)}
            {input("endsAt", "Ends", "datetime-local", true)}
            <button className="btn btn-primary btn-sm">Create (no announcement until photos)</button>
          </form>
        )}

        {sales.length === 0 && (
          <div style={{ fontSize: 13, color: "#999" }}>
            {loading ? "Loading…" : "No sales yet."}
          </div>
        )}

        {sales.map((sale) => {
          const checklist = sale.checklist ?? {};
          const checked = ESTATE_CHECKLIST_ITEMS.filter((i) => checklist[i.key]).length;
          return (
            <div
              key={sale.id}
              style={{ border: "1px solid #e5e5ea", borderRadius: 10, padding: 12, marginBottom: 10 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>{sale.title}</strong>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: sale.status === "done" ? "#e8f5e9" : sale.status === "live" ? "#fff3e0" : "#e3f2fd",
                    color: sale.status === "done" ? "#2e7d32" : sale.status === "live" ? "#e65100" : "#1565c0",
                  }}
                >
                  {sale.status}
                </span>
                <a
                  href={`/estate/sales/${sale.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "#0a84ff", textDecoration: "none" }}
                >
                  /estate/sales/{sale.slug}
                </a>
                {sale.grossTotal != null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#2e7d32", marginLeft: "auto" }}>
                    ${sale.grossTotal.toLocaleString("en-US")} gross
                  </span>
                )}
              </div>

              <div style={{ fontSize: 12, color: "#6e6e73", margin: "6px 0" }}>
                {shortDateTime(sale.startsAt)} → {shortDateTime(sale.endsAt)} · {sale.photos.length}{" "}
                photos · {sale._count.leads} linked leads
                {sale.status !== "done" && (
                  <>
                    {" · "}VIP reveal {countdown(sale.vipNotifyAt)}
                    {sale.vipNotifiedAt ? " (sent ✓)" : ""}
                    {" · "}public reveal {countdown(sale.addressPublishAt)}
                    {" · "}address {sale.address ? "on file 🔒" : "NOT SET"}
                    {" · "}announcement {sale.announcedAt ? "sent ✓" : sale.photos.length ? "armed" : "waiting on photos"}
                  </>
                )}
              </div>

              {sale.status !== "done" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button className="btn btn-sm" disabled={busyId === sale.id} onClick={() => setAddress(sale)}>
                    {sale.address ? "Edit address" : "Set address (arms VIP blast)"}
                  </button>
                  <button className="btn btn-sm" disabled={busyId === sale.id} onClick={() => setWhen(sale, "vipNotifyAt")}>
                    VIP reveal time
                  </button>
                  <button className="btn btn-sm" disabled={busyId === sale.id} onClick={() => setWhen(sale, "addressPublishAt")}>
                    Public reveal time
                  </button>
                  <button
                    className="btn btn-sm"
                    disabled={busyId === sale.id}
                    onClick={() => uploadRefs.current[sale.id]?.click()}
                  >
                    + Photos (EXIF-stripped only)
                  </button>
                  <input
                    ref={(el) => {
                      uploadRefs.current[sale.id] = el;
                    }}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                    onChange={(e) => {
                      uploadPhotos(sale, e.target.files);
                      e.target.value = "";
                    }}
                  />
                  {sale.status === "upcoming" && (
                    <button className="btn btn-sm" disabled={busyId === sale.id} onClick={() => patchSale(sale.id, { status: "live" })}>
                      Mark live
                    </button>
                  )}
                  <button className="btn btn-sm" disabled={busyId === sale.id} onClick={() => markDone(sale)}>
                    Mark done (scrubs address)
                  </button>
                </div>
              )}

              <details>
                <summary style={{ fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#6e6e73" }}>
                  Playbook checklist ({checked}/{ESTATE_CHECKLIST_ITEMS.length})
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 4, marginTop: 8 }}>
                  {ESTATE_CHECKLIST_ITEMS.map((item) => (
                    <label key={item.key} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(checklist[item.key])}
                        disabled={busyId === sale.id}
                        onChange={(e) =>
                          patchSale(sale.id, { checklist: { [item.key]: e.target.checked } })
                        }
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {/* ─── Seller pipeline ─── */}
      <div className="panel" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>Seller pipeline</strong>
          <button className="btn btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowNewLead((s) => !s)}>
            {showNewLead ? "Cancel" : "+ New lead"}
          </button>
        </div>

        {showNewLead && (
          <form
            onSubmit={(e) => createFromForm(e, "/api/hq/estate/leads", () => setShowNewLead(false))}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, padding: 10, background: "#fafafa", borderRadius: 8 }}
          >
            {input("name", "Family / contact name", "text", true)}
            {input("phone", "Phone")}
            {input("email", "Email", "email")}
            {input("address", "Property address")}
            <select name="source" style={{ padding: "6px 10px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 13 }}>
              <option value="manual">manual</option>
              <option value="referral">referral</option>
              <option value="fb">fb</option>
              <option value="esn">esn</option>
              <option value="probate">probate</option>
              <option value="inbound">inbound</option>
            </select>
            {input("notes", "Notes")}
            <button className="btn btn-primary btn-sm">Add lead</button>
          </form>
        )}

        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {ESTATE_LEAD_STAGES.map((stage) => {
            const inStage = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} style={{ minWidth: 190, flex: "0 0 190px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#6e6e73", textTransform: "uppercase", marginBottom: 6 }}>
                  {STAGE_LABEL[stage]} ({inStage.length})
                </div>
                {inStage.map((lead) => (
                  <div key={lead.id} style={{ border: "1px solid #e5e5ea", borderRadius: 8, padding: 8, marginBottom: 6, fontSize: 12 }}>
                    <strong>{lead.name}</strong>
                    <div style={{ color: "#6e6e73" }}>
                      {[lead.phone, lead.email].filter(Boolean).join(" · ") || "no contact"}
                    </div>
                    {lead.address && <div style={{ color: "#6e6e73" }}>{lead.address}</div>}
                    <div style={{ color: "#6e6e73" }}>src: {lead.source}{lead.sale ? ` · ${lead.sale.slug}` : ""}</div>
                    <select
                      value={lead.stage}
                      disabled={busyId === lead.id}
                      onChange={(e) => patchLead(lead.id, { stage: e.target.value })}
                      style={{ marginTop: 4, width: "100%", padding: "3px 6px", border: "1px solid #e5e5ea", borderRadius: 6, fontSize: 11 }}
                    >
                      {ESTATE_LEAD_STAGES.map((s) => (
                        <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── VIP list ─── */}
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>VIP email list</strong>
          <span style={{ fontSize: 13, color: "#6e6e73" }}>
            {vipCount == null ? "—" : `${vipCount} subscribers`} (2-touch policy: announcement + address only)
          </span>
          <button
            className="btn btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={async () => {
              if (vipList) {
                setVipList(null);
                return;
              }
              const r = await fetch("/api/hq/estate/vips?list=1");
              if (r.ok) setVipList((await r.json()).subscribers);
            }}
          >
            {vipList ? "Hide list" : "Show list (PII)"}
          </button>
        </div>
        {vipList && (
          <div style={{ marginTop: 8, fontSize: 12, columns: "3 220px" }}>
            {vipList.map((s) => (
              <div key={s.email} style={{ breakInside: "avoid", padding: "2px 0" }}>
                {s.email}{" "}
                <span style={{ color: "#999" }}>
                  {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
