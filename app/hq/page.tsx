"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { HQ_BOARD_STAGES, HQ_OFFERS } from "@/lib/hq";
import { useToast } from "@/components/ui/Toast";
import { HqBk } from "@/components/hq/hq-bk";
import { HqVaterDue } from "@/components/hq/hq-vater-due";
import { HqStudioUsers } from "@/components/hq/hq-studio-users";
import { HqBoard } from "@/components/hq/hq-board";
import { HqLeadDrawer } from "@/components/hq/hq-lead-drawer";
import { HqApprovalQueue } from "@/components/hq/hq-approval-queue";
import {
  HqLicenseReviews,
  type HqLicenseReview,
} from "@/components/hq/hq-license-reviews";
import { HqMoney } from "@/components/hq/hq-money";
import { HqJellyPnl } from "@/components/hq/hq-jelly-pnl";
import { HqEngineStatus } from "@/components/hq/hq-engine-status";
import { HqAiPnl } from "@/components/hq/hq-ai-pnl";
import { HqInbound } from "@/components/hq/hq-inbound";
import { HqDnc } from "@/components/hq/hq-dnc";
import { HqStats } from "@/components/hq/hq-stats";
import { HqEsnKit } from "@/components/hq/hq-esn-kit";
import { HqEstates } from "@/components/hq/hq-estates";
import { HqEmpireMap } from "@/components/hq/hq-empire-map";
import { HqFbChats } from "@/components/hq/hq-fb-chats";
import { HqHaulAppraisals } from "@/components/hq/hq-haul-appraisals";
import { HqPosts } from "@/components/hq/hq-posts";
import { HqTiktokShop } from "@/components/hq/hq-tiktok-shop";
import { HqChannelScoreboard } from "@/components/hq/hq-channel-scoreboard";
import { HqSiteVisits } from "@/components/hq/hq-site-visits";
import {
  HqMustComplete,
  type MustCompleteItem,
} from "@/components/hq/hq-must-complete";
import {
  STAGE_LABEL,
  readApiError,
  type HqLead,
  type HqMoney as HqMoneyData,
  type HqQueueTouch,
  type HqInboundLead,
} from "@/components/hq/types";

type Tab = "empire" | "must" | "pipeline" | "inbound" | "approvals" | "money" | "dnc" | "estates" | "stats" | "site" | "chats" | "hauls" | "posts" | "tiktok" | "bk";

const TABS: readonly Tab[] = ["empire", "must", "pipeline", "inbound", "approvals", "money", "dnc", "estates", "stats", "site", "chats", "hauls", "posts", "tiktok", "bk"];

function isTab(v: string | null): v is Tab {
  return v != null && (TABS as readonly string[]).includes(v);
}

export default function HqPage() {
  // useSearchParams (for ?tab= deep links) requires a Suspense boundary at build.
  return (
    <Suspense fallback={null}>
      <HqPageInner />
    </Suspense>
  );
}

function HqPageInner() {
  const { toast } = useToast();

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(isTab(urlTab) ? urlTab : "empire");

  // Keep the URL shareable — replaceState avoids a Next navigation/remount.
  useEffect(() => {
    window.history.replaceState(null, "", tab === "empire" ? "/hq" : `/hq?tab=${tab}`);
  }, [tab]);
  const [mustOpen, setMustOpen] = useState<MustCompleteItem[]>([]);
  const [mustDone, setMustDone] = useState<MustCompleteItem[]>([]);
  const [mustLoading, setMustLoading] = useState(false);
  const [mustBusyId, setMustBusyId] = useState<string | null>(null);
  const [leads, setLeads] = useState<HqLead[]>([]);
  const [drafts, setDrafts] = useState<HqQueueTouch[]>([]);
  const [offerFilter, setOfferFilter] = useState<string>("all");
  const [selected, setSelected] = useState<HqLead | null>(null);
  const [saving, setSaving] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [money, setMoney] = useState<HqMoneyData | null>(null);
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [inbound, setInbound] = useState<HqInboundLead[]>([]);
  const [inboundCounts, setInboundCounts] = useState<Record<string, number>>({});
  const [inboundLoading, setInboundLoading] = useState(false);
  const [inboundBusyId, setInboundBusyId] = useState<string | null>(null);
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

  const loadInbound = useCallback(async () => {
    setInboundLoading(true);
    try {
      const r = await fetch("/api/hq/inbound");
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load inbound"));
      const d = await r.json();
      setInbound(d.leads);
      setInboundCounts(d.counts ?? {});
    } catch (err) {
      toast({
        title: "Failed to load inbound leads",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setInboundLoading(false);
    }
  }, [toast]);

  async function advanceInbound(id: string, status: string) {
    setInboundBusyId(id);
    try {
      const r = await fetch(`/api/hq/inbound/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Update failed"));
      await loadInbound();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "error" });
    } finally {
      setInboundBusyId(null);
    }
  }

  async function noteInbound(id: string, note: string): Promise<boolean> {
    setInboundBusyId(id);
    try {
      const r = await fetch(`/api/hq/inbound/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Save failed"));
      await loadInbound();
      return true;
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : String(err), variant: "error" });
      return false;
    } finally {
      setInboundBusyId(null);
    }
  }

  async function replyInbound(id: string, subject: string, body: string): Promise<boolean> {
    setInboundBusyId(id);
    try {
      const r = await fetch(`/api/hq/inbound/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Send failed"));
      const d = await r.json();
      toast({ title: "Reply sent", description: `Sent to ${d.to}` });
      await loadInbound();
      return true;
    } catch (err) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : String(err), variant: "error" });
      return false;
    } finally {
      setInboundBusyId(null);
    }
  }

  const loadMust = useCallback(async () => {
    setMustLoading(true);
    try {
      const r = await fetch("/api/hq/must-complete");
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load Must Complete queue"));
      const d = await r.json();
      setMustOpen(d.open);
      setMustDone(d.done);
    } catch (err) {
      toast({
        title: "Failed to load Must Complete queue",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
    } finally {
      setMustLoading(false);
    }
  }, [toast]);

  async function setMustStatus(id: string, status: "open" | "done" | "dismissed"): Promise<boolean> {
    setMustBusyId(id);
    try {
      const r = await fetch(`/api/hq/must-complete/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error(await readApiError(r, "Update failed"));
      if (status === "done") toast({ title: "Checked off ✓", variant: "success" });
      await loadMust();
      return true;
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : String(err), variant: "error" });
      return false;
    } finally {
      setMustBusyId(null);
    }
  }

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
      loadMust();
      loadDrafts();
      loadMoney();
      loadLicenseReviews();
      loadInbound();
    }
  }, [authed, loadMust, loadDrafts, loadMoney, loadLicenseReviews, loadInbound]);

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

  // ─── Logout ───
  async function handleLogout() {
    try {
      const r = await fetch("/api/hq/logout", { method: "POST" });
      if (!r.ok) throw new Error(await readApiError(r, "Sign out failed"));
    } catch (err) {
      toast({
        title: "Sign out failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "error",
      });
      return;
    }
    // Drop every loaded row with the session — the next person at this screen
    // should see the PIN prompt, not the last operator's pipeline.
    setAuthed(false);
    setPin("");
    setLeads([]);
    setDrafts([]);
    setInbound([]);
    setMoney(null);
    setSelected(null);
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
  const dncCount = leads.filter((l) => l.stage === "do_not_contact").length;
  const moneyCount = money
    ? money.wd.pastDue.length + money.wd.pendingApproval.length + money.invoices.open.length
    : undefined;
  const boardLeads =
    offerFilter === "all" ? leads : leads.filter((l) => l.offer === offerFilter);

  // ─── Tab bar helpers ───
  // One shape for every tab pill; per-tab tints are classes in hq.css.
  function tabPill(id: Tab, label: string, count?: number, tint?: string) {
    return (
      <button
        className={`tab-btn${tint ? ` ${tint}` : ""}${tab === id ? " active" : ""}`}
        onClick={() => setTab(id)}
        aria-current={tab === id ? "true" : undefined}
      >
        {label}
        {count ? ` (${count})` : ""}
      </button>
    );
  }

  // <details> has no built-in dismiss, so a stray open Docs menu would sit over
  // the page until re-clicked. Close it on outside-click and on Escape.
  const docsRef = useRef<HTMLDetailsElement>(null);
  const closeDocs = () => {
    if (docsRef.current) docsRef.current.open = false;
  };
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      const el = docsRef.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && docsRef.current?.open) docsRef.current.open = false;
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
              style={{ width: "100%", padding: "8px 12px", marginBottom: 12, border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 14, textAlign: "center", boxSizing: "border-box" }}
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
          <HqAiPnl />
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
              loadMust();
              loadDrafts();
              loadMoney();
              loadLicenseReviews();
              loadInbound();
            }}
          >
            ↻ Refresh
          </button>
          <button className="btn btn-sm" onClick={handleLogout} title="Clear the admin session on this device">
            Sign out
          </button>
        </div>
      </div>

      <div className="hq-content">
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

        {/* Tab bar. Grouped Ops | Growth | Content; the strip scrolls sideways
            (see hq.css) so adding a tab never widens the page. Docs and the
            offer filter sit outside the scroller — an overflow container would
            clip the open Docs menu. */}
        <div className="tab-bar">
          <div className="tab-strip">
            {/* Ops */}
            {tabPill("empire", "🗺️ Empire", undefined, "tab-empire")}
            {tabPill("must", "🎯 Must Complete", mustOpen.length, "tab-must")}
            {tabPill("money", "Money", moneyCount)}
            {tabPill("site", "🌐 Site")}

            <span className="tab-sep" aria-hidden="true" />

            {/* Growth */}
            {tabPill("pipeline", "Pipeline")}
            {tabPill("inbound", "Inbox", inboundCounts.new)}
            {tabPill("approvals", "Approvals", drafts.length + licenseReviews.length)}
            {tabPill("estates", "Estates")}
            {tabPill("dnc", "Contacted / DNC", dncCount)}

            <span className="tab-sep" aria-hidden="true" />

            {/* Content — the two /generate and /persona pills are their own
                routes, not tab states, so they stay plain links. */}
            <a
              className="tab-btn"
              href="/generate"
              title="Quick Generate — prompt → image / video (Gemini + Wan2.2)"
            >
              ✨ Generate
            </a>
            {/* /persona is gated by a NextAuth admin session, not the /hq PIN
                (HQ-03), so from here it 401s. Keep the link — it works once
                you're signed into the site — but say so and open it in its own
                tab so a dead-end doesn't cost you the HQ session. */}
            <a
              className="tab-btn"
              href="/persona"
              target="_blank"
              rel="noopener noreferrer"
              title="Persona Editor — edit her description, wardrobe, and face. Needs a site login (NextAuth admin), not the HQ PIN — opens in a new tab."
            >
              💃 Persona <span style={{ opacity: 0.6, fontWeight: 500 }}>(needs site login)</span>
            </a>
            {tabPill("stats", "Stats")}
            {tabPill("chats", "Chats")}
            {tabPill("hauls", "💎 Hauls")}
            {tabPill("posts", "📡 Posts")}
            {tabPill("tiktok", "🛍 TikTok")}
            {/* Storefront stocking is its own route (big static worklist), not a tab state. */}
            <a className="tab-btn" href="/hq/storefront">
              🛒 Storefront
            </a>
            {tabPill("bk", "⚡ BK", undefined, "tab-bk")}
          </div>

          <div className="tab-bar-end">
            {/* Read-once briefs live in one dropdown so the next PDF doesn't
                cost another tab's worth of bar. Static files in /public/research. */}
            <details className="tab-docs" ref={docsRef}>
              <summary className="tab-btn">📄 Docs ▾</summary>
              <div className="tab-docs-menu">
                <a
                  href="/research/lady-video-system-2026-08.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeDocs}
                >
                  🎬 Lady Video System
                  <span className="doc-sub">How a lady video is actually made — every stage with real frames + timestamps, all four lanes, every internet call, how the links are built, what it costs — Aug 18, 2026</span>
                </a>
                <a
                  href="/research/jelly-competitor-gaps-2026-08.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeDocs}
                >
                  🥊 Competitor Gaps
                  <span className="doc-sub">What TubeGen/Vidnoz/Argil/StoryShort/NoLang/Zebracat/Faceless.so have that Jelly doesn&apos;t — and how we add it — Aug 16, 2026</span>
                </a>
                <a
                  href="/research/jelly-beta-launch-2026-08.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeDocs}
                >
                  🚀 Jelly Beta Launch
                  <span className="doc-sub">Research swarm findings + 4-phase plan to ship /animate as an invite-only beta — Aug 15, 2026</span>
                </a>
                <a
                  href="/research/hq-animate-overhaul-2026-08.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeDocs}
                >
                  🛠 HQ + Animate Overhaul
                  <span className="doc-sub">Audit, security, dead-ends fixed; /animate made sellable — Aug 15, 2026</span>
                </a>
                <a
                  href="/research/hardware-upgrade-plan-2026-08.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeDocs}
                >
                  🔧 Hardware Plan
                  <span className="doc-sub">16TB vs 12TB settled, where to buy, second GB10 — Aug 14, 2026</span>
                </a>
                <a
                  href="/research/youtube-video-length-2026.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeDocs}
                >
                  📄 YT Length Study
                  <span className="doc-sub">What video length is actually correct for YouTube — Aug 2026</span>
                </a>
              </div>
            </details>

            {tab === "pipeline" && (
              <select
                value={offerFilter}
                onChange={(e) => setOfferFilter(e.target.value)}
                aria-label="Filter pipeline by offer"
                style={{ padding: "5px 10px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff" }}
              >
                <option value="all">All offers</option>
                {HQ_OFFERS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {tab === "empire" ? (
          <HqEmpireMap />
        ) : tab === "must" ? (
          <>
            <HqVaterDue />
            <HqStudioUsers />
            <HqMustComplete
              open={mustOpen}
              done={mustDone}
              loading={mustLoading}
              busyId={mustBusyId}
              onRefresh={loadMust}
              onSetStatus={setMustStatus}
            />
          </>
        ) : tab === "pipeline" ? (
          <HqBoard leads={boardLeads} onSelect={setSelected} />
        ) : tab === "inbound" ? (
          <HqInbound
            leads={inbound}
            counts={inboundCounts}
            loading={inboundLoading}
            busyId={inboundBusyId}
            onRefresh={loadInbound}
            onAdvance={advanceInbound}
            onNote={noteInbound}
            onReply={replyInbound}
          />
        ) : tab === "money" ? (
          <>
            <HqJellyPnl />
            <HqMoney money={money} loading={moneyLoading} onRefresh={loadMoney} />
          </>
        ) : tab === "estates" ? (
          <>
            <HqEsnKit />
            <HqEstates />
          </>
        ) : tab === "stats" ? (
          <>
            <HqChannelScoreboard />
            <HqStats />
          </>
        ) : tab === "site" ? (
          <HqSiteVisits />
        ) : tab === "chats" ? (
          <HqFbChats />
        ) : tab === "hauls" ? (
          <HqHaulAppraisals />
        ) : tab === "posts" ? (
          <HqPosts />
        ) : tab === "tiktok" ? (
          <HqTiktokShop />
        ) : tab === "bk" ? (
          <HqBk />
        ) : tab === "dnc" ? (
          <HqDnc
            leads={leads}
            busy={saving}
            onMarkDnc={(id) => saveLead(id, { stage: "do_not_contact" })}
          />
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
              onApprove={(id) => patchTouch(id, { action: "approve" }, "Approved")}
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
