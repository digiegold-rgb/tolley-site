"use client";

import { useCallback, useEffect, useState } from "react";

import { HQ_BOARD_STAGES, HQ_OFFERS } from "@/lib/hq";
import { useToast } from "@/components/ui/Toast";
import { HqBoard } from "@/components/hq/hq-board";
import { HqLeadDrawer } from "@/components/hq/hq-lead-drawer";
import { HqApprovalQueue } from "@/components/hq/hq-approval-queue";
import {
  HqLicenseReviews,
  type HqLicenseReview,
} from "@/components/hq/hq-license-reviews";
import { HqMoney } from "@/components/hq/hq-money";
import { HqEngineStatus } from "@/components/hq/hq-engine-status";
import {
  STAGE_LABEL,
  readApiError,
  type HqLead,
  type HqMoney as HqMoneyData,
  type HqQueueTouch,
} from "@/components/hq/types";

type Tab = "pipeline" | "approvals" | "money";

export default function HqPage() {
  const { toast } = useToast();

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [tab, setTab] = useState<Tab>("pipeline");
  const [leads, setLeads] = useState<HqLead[]>([]);
  const [drafts, setDrafts] = useState<HqQueueTouch[]>([]);
  const [offerFilter, setOfferFilter] = useState<string>("all");
  const [selected, setSelected] = useState<HqLead | null>(null);
  const [saving, setSaving] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [money, setMoney] = useState<HqMoneyData | null>(null);
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [licenseReviews, setLicenseReviews] = useState<HqLicenseReview[]>([]);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseBusyId, setLicenseBusyId] = useState<string | null>(null);

  // ─── Data loaders ───
  const loadLeads = useCallback(async () => {
    const r = await fetch("/api/hq/leads");
    if (!r.ok) throw new Error(await readApiError(r, "Failed to load leads"));
    const d = await r.json();
    setLeads(d.leads);
    return d.leads as HqLead[];
  }, []);

  const loadDrafts = useCallback(async () => {
    setQueueLoading(true);
    try {
      const r = await fetch("/api/hq/touches?status=draft");
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load drafts"));
      const d = await r.json();
      setDrafts(d.touches);
    } catch (err) {
      toast({
        title: "Failed to load drafts",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setQueueLoading(false);
    }
  }, [toast]);

  const loadLicenseReviews = useCallback(async () => {
    setLicenseLoading(true);
    try {
      const r = await fetch("/api/hq/license-reviews");
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load license reviews"));
      const d = await r.json();
      setLicenseReviews(d.reviews);
    } catch (err) {
      toast({
        title: "Failed to load license reviews",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setLicenseLoading(false);
    }
  }, [toast]);

  const loadMoney = useCallback(async () => {
    setMoneyLoading(true);
    try {
      const r = await fetch("/api/hq/money");
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load money data"));
      const d = await r.json();
      setMoney(d);
    } catch (err) {
      toast({
        title: "Failed to load money data",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setMoneyLoading(false);
    }
  }, [toast]);

  // ─── Auth check on mount (401 = show PIN screen, anything else = error) ───
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/hq/leads");
        if (r.status === 401) return; // not logged in — expected
        if (!r.ok) throw new Error(await readApiError(r, "Failed to load leads"));
        const d = await r.json();
        setLeads(d.leads);
        setAuthed(true);
      } catch (err) {
        toast({
          title: "Growth HQ failed to load",
          description: err instanceof Error ? err.message : String(err),
          variant: "error",
        });
      } finally {
        setChecking(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    if (authed) {
      loadDrafts();
      loadMoney();
      loadLicenseReviews();
    }
  }, [authed, loadDrafts, loadMoney, loadLicenseReviews]);

  // ─── Login ───
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    try {
      const res = await fetch("/api/hq/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setPinError(res.status === 401 ? "Invalid PIN" : await readApiError(res, "Login failed"));
        return;
      }
      await loadLeads();
      setAuthed(true);
    } catch (err) {
      setPinError(err instanceof Error ? err.message : "Login failed");
    }
  }

  // ─── Lead save (drawer) ───
  async function saveLead(id: string, fields: Record<string, string | number | null>) {
    setSaving(true);
    try {
      const r = await fetch(`/api/hq/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Save failed"));
      const d = await r.json();
      setLeads((prev) => prev.map((l) => (l.id === id ? d.lead : l)));
      toast({ title: "Lead saved", variant: "success" });
      return true;
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ─── License review actions ───
  async function resolveLicense(id: string, action: "approve" | "reject") {
    setLicenseBusyId(id);
    try {
      const r = await fetch(`/api/hq/license-reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Update failed"));
      toast({
        title:
          action === "approve"
            ? "License approved — digest keeps flowing"
            : "Rejected — subscription canceled",
        variant: "success",
      });
      await loadLicenseReviews();
    } catch (err) {
      toast({
        title: "License review failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setLicenseBusyId(null);
    }
  }

  // ─── Touch actions (approval queue) ───
  async function patchTouch(
    id: string,
    payload: Record<string, string>,
    successTitle: string
  ): Promise<boolean> {
    setBusyId(id);
    try {
      const r = await fetch(`/api/hq/touches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Update failed"));
      toast({ title: successTitle, variant: "success" });
      await loadDrafts();
      return true;
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  // ─── Derived stats ───
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const addedThisWeek = leads.filter((l) => new Date(l.createdAt).getTime() >= weekAgo).length;
  const deadCount = leads.filter((l) => l.stage === "dead").length;
  const boardLeads =
    offerFilter === "all" ? leads : leads.filter((l) => l.offer === offerFilter);

  // ─── Screens ───
  if (checking) {
    return (
      <div className="auth-screen">
        <div style={{ color: "#666" }}>Loading…</div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="auth-screen">
        <div className="auth-box">
          <h2>Growth HQ</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", marginBottom: 12, border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 14, textAlign: "center", boxSizing: "border-box" }}
              autoFocus
            />
            {pinError && (
              <div style={{ color: "#c44", fontSize: 12, marginBottom: 8 }}>{pinError}</div>
            )}
            <button className="btn btn-primary" style={{ width: "100%" }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Top bar */}
      <div className="topbar">
        <span className="title">Growth HQ — Pipeline</span>
        <div className="actions">
          <HqEngineStatus />
          <button
            className="btn btn-sm"
            onClick={() => {
              loadLeads().catch((err) =>
                toast({
                  title: "Refresh failed",
                  description: err instanceof Error ? err.message : String(err),
                  variant: "error",
                })
              );
              loadDrafts();
              loadMoney();
              loadLicenseReviews();
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* Stat row */}
        <div className="stat-row">
          {HQ_BOARD_STAGES.map((s) => (
            <div key={s} className={`stat-card${s === "client" ? " accent-green" : ""}`}>
              <h4>{STAGE_LABEL[s] || s}</h4>
              <div className="val">{leads.filter((l) => l.stage === s).length}</div>
            </div>
          ))}
          <div className="stat-card accent-yellow">
            <h4>Drafts Pending</h4>
            <div className="val">{drafts.length}</div>
          </div>
          <div className="stat-card accent-purple">
            <h4>New This Week</h4>
            <div className="val">{addedThisWeek}</div>
          </div>
          {deadCount > 0 && (
            <div className="stat-card accent-gray">
              <h4>Dead</h4>
              <div className="val">{deadCount}</div>
            </div>
          )}
        </div>

        {/* Tab bar + offer filter */}
        <div className="tab-bar" style={{ alignItems: "center" }}>
          <button
            className={`tab-btn ${tab === "pipeline" ? "active" : ""}`}
            onClick={() => setTab("pipeline")}
          >
            Pipeline
          </button>
          <button
            className={`tab-btn ${tab === "approvals" ? "active" : ""}`}
            onClick={() => setTab("approvals")}
          >
            Approvals
            {drafts.length + licenseReviews.length > 0
              ? ` (${drafts.length + licenseReviews.length})`
              : ""}
          </button>
          <button
            className={`tab-btn ${tab === "money" ? "active" : ""}`}
            onClick={() => setTab("money")}
          >
            Money
            {money
              ? ` (${money.wd.pastDue.length + money.wd.pendingApproval.length + money.invoices.open.length})`
              : ""}
          </button>
          {tab === "pipeline" && (
            <select
              value={offerFilter}
              onChange={(e) => setOfferFilter(e.target.value)}
              style={{ marginLeft: "auto", padding: "5px 10px", border: "1px solid #d1d1d6", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff" }}
            >
              <option value="all">All offers</option>
              {HQ_OFFERS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          )}
        </div>

        {tab === "pipeline" ? (
          <HqBoard leads={boardLeads} onSelect={setSelected} />
        ) : tab === "money" ? (
          <HqMoney money={money} loading={moneyLoading} onRefresh={loadMoney} />
        ) : (
          <>
            <HqLicenseReviews
              reviews={licenseReviews}
              loading={licenseLoading}
              busyId={licenseBusyId}
              onRefresh={loadLicenseReviews}
              onApprove={(id) => resolveLicense(id, "approve")}
              onReject={(id) => resolveLicense(id, "reject")}
            />
            <HqApprovalQueue
              touches={drafts}
              loading={queueLoading}
              busyId={busyId}
              onRefresh={loadDrafts}
              onApprove={(id) => patchTouch(id, { action: "approve" }, "Approved — sender cron will pick it up")}
              onDiscard={(id) => patchTouch(id, { action: "discard" }, "Draft discarded")}
              onSaveEdit={(id, subject, body) => patchTouch(id, { subject, body }, "Draft updated")}
            />
          </>
        )}
      </div>

      {selected && (
        <HqLeadDrawer
          lead={leads.find((l) => l.id === selected.id) ?? selected}
          saving={saving}
          onClose={() => setSelected(null)}
          onSave={saveLead}
        />
      )}
    </div>
  );
}
