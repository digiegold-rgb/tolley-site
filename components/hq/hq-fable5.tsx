"use client";

/**
 * /hq → "📜 Fable 5" — the Concierge operator queue.
 *
 * Reads GET /api/vater/concierge/queue (PIN cookie) and drives the operator
 * routes under /api/vater/concierge/[ticket]/*. Grouped per customer; each
 * ticket card carries the pack + `/fable5` command the operator pastes into
 * Claude Code on the DGX, plus the manual levers (claim / stage / kickoff /
 * sync / deliver / cancel) for when the CLI is not at hand.
 *
 * ⚠️ Do NOT use this tab while "view-as" is active on /animate: proxy.ts
 * blocks every non-GET under /api/vater while the `jelly_view_as` cookie is
 * present (403 VIEW_AS_READ_ONLY), so every button here would fail.
 */

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import {
  CONCIERGE_STAGES,
  auditChipLabel,
  auditMatchesFinal,
  relativeTimeLabel,
  type ConciergeAudit,
  type ConciergeStage,
} from "@/lib/vater/concierge-client";
import { readApiError } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types — mirror app/api/vater/concierge/queue/route.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface Fable5Ticket {
  code: string;
  projectId: string;
  title: string;
  words: number;
  estMinutes: number;
  estimateUsd: number;
  stage: ConciergeStage;
  status: string;
  submittedAt: string;
  claimedAt: string | null;
  claimedBy: string | null;
  deliveredAt: string | null;
  jobId: string | null;
  composeJobId: string | null;
  operatorNote: string | null;
  internalNote: string | null;
  customerNote: string | null;
  /** Latest delivery audit (fable5-audit.py → /audit). null = none yet. */
  audit: ConciergeAudit | null;
  finalVideoUrl: string | null;
  ageMin: number;
  errorMessage: string | null;
  dgxPhase: string | null;
  updatedAt: string;
}

export interface Fable5User {
  userId: string;
  email: string | null;
  name: string | null;
  tier: string;
  lane: "vater" | "jelly";
  unmetered: boolean;
  balanceUsd: number | null;
  maxWords: number | null;
  tickets: Fable5Ticket[];
}

export interface Fable5Queue {
  generatedAt: string;
  counts: { queued: number; in_progress: number; needs_info: number };
  users: Fable5User[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_STYLE: Record<ConciergeStage, { bg: string; fg: string; label: string }> = {
  queued: { bg: "#ede9fe", fg: "#6d28d9", label: "Queued" },
  picked_up: { bg: "#dbeafe", fg: "#1d4ed8", label: "Picked up" },
  directing: { bg: "#dbeafe", fg: "#1d4ed8", label: "Directing" },
  rendering: { bg: "#fef9c3", fg: "#a16207", label: "Rendering" },
  qa: { bg: "#ffedd5", fg: "#c2410c", label: "Quality check" },
  delivered: { bg: "#dcfce7", fg: "#15803d", label: "Delivered" },
  needs_info: { bg: "#fee2e2", fg: "#b91c1c", label: "Needs info" },
  cancelled: { bg: "#f0f0f5", fg: "#3a3a3c", label: "Cancelled" },
};

/** Stages the /stage route accepts (delivered/cancelled have their own buttons). */
const OPERATOR_STAGES: ConciergeStage[] = ["picked_up", "directing", "rendering", "qa", "needs_info"];

const TERMINAL: ReadonlySet<ConciergeStage> = new Set<ConciergeStage>(["delivered", "cancelled"]);

const usd = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(2)}`);

function StagePill({ stage }: { stage: ConciergeStage }) {
  const s = STAGE_STYLE[stage] ?? STAGE_STYLE.queued;
  return (
    <span className="pill" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

/** A 409 from /deliver the card renders inline instead of a toast. */
export class DeliverGateError extends Error {
  code: string;
  reportUrl: string | null;
  constructor(code: string, message: string, reportUrl: string | null = null) {
    super(message);
    this.code = code;
    this.reportUrl = reportUrl;
  }
}

async function postTicket(code: string, action: string, body: Record<string, unknown> = {}) {
  const r = await fetch(`/api/vater/concierge/${encodeURIComponent(code)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ by: "hq", ...body }),
  });
  if (r.status === 409 && action === "deliver") {
    const d = (await r.clone().json().catch(() => null)) as
      | { code?: string; message?: string; error?: string; hardFails?: number; sceneCount?: number; round?: number; reportUrl?: string | null }
      | null;
    if (d?.code === "audit_missing") {
      throw new DeliverGateError("audit_missing", d.message || d.error || "no delivery audit for this final yet");
    }
    if (d?.code === "audit_failed") {
      throw new DeliverGateError(
        "audit_failed",
        `audit r${d.round ?? "?"} FAILED — ${d.hardFails ?? "?"}/${d.sceneCount ?? "?"} scenes with hard failures. Repair + re-audit, or deliver anyway with a reason.`,
        typeof d.reportUrl === "string" ? d.reportUrl : null,
      );
    }
  }
  if (!r.ok) throw new Error(await readApiError(r, `${action} failed`));
  return r.json();
}

/** Why the Deliver button is disabled (null = deliverable). Audit is a warning, not a gate. */
export function deliverBlockReason(t: Pick<Fable5Ticket, "audit" | "finalVideoUrl" | "jobId" | "composeJobId">): string | null {
  if (!t.finalVideoUrl) return "No final video on the row yet — render + sync first.";
  return null;
}

/** Operator-facing audit warning. Never blocks delivery of a live final. */
export function deliverAuditWarning(t: Pick<Fable5Ticket, "audit" | "finalVideoUrl" | "jobId" | "composeJobId">): string | null {
  if (!t.finalVideoUrl) return null;
  const a = t.audit;
  const matches = auditMatchesFinal(a, { finalVideoUrl: t.finalVideoUrl, jobId: t.jobId, composeJobId: t.composeJobId });
  if (!a) return "No delivery audit yet — delivering the file anyway. Repair later if you want.";
  if (!matches) return `Last audit (r${a.round}, ${a.source}) is not for this final — delivering anyway.`;
  if (!a.passed) return `Audit r${a.round} FAILED ${a.hardFails}/${a.sceneCount} hard — delivering the file anyway.`;
  return null;
}

function AuditChip({ audit }: { audit: ConciergeAudit | null }) {
  const label = auditChipLabel(audit);
  const style = !audit
    ? { background: "#f0f0f5", color: "#6b7280" }
    : audit.passed
      ? { background: "#dcfce7", color: "#15803d" }
      : { background: "#fee2e2", color: "#b91c1c" };
  const title = audit
    ? `${audit.source} · ${audit.judged}/${audit.sceneCount} judged · $${audit.costUsd.toFixed(2)} · ${audit.at}` +
      (audit.hardScenes.length ? ` · hard scenes ${audit.hardScenes.slice(0, 20).join(", ")}${audit.hardScenes.length > 20 ? "…" : ""}` : "") +
      (Object.keys(audit.byCheck).length
        ? ` · ${Object.entries(audit.byCheck)
            .sort((x, y) => y[1] - x[1])
            .map(([k, v]) => `${k} ${v}`)
            .join(", ")}`
        : "")
    : "fable5-audit.py has not posted an audit for this ticket";
  if (audit?.reportUrl) {
    return (
      <a className="pill" href={audit.reportUrl} target="_blank" rel="noreferrer" style={{ ...style, textDecoration: "none" }} title={title} data-testid="f5-audit-chip">
        {label} ↗
      </a>
    );
  }
  return (
    <span className="pill" style={style} title={title} data-testid="f5-audit-chip">
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function HqFable5({
  data,
  loading,
  onRefresh,
}: {
  data: Fable5Queue | null;
  loading: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showDelivered, setShowDelivered] = useState(false);
  const [delivered, setDelivered] = useState<Fable5User[] | null>(null);

  // Auto-refresh every 30 s while the tab is mounted.
  useEffect(() => {
    const t = setInterval(() => {
      void onRefresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [onRefresh]);

  const loadDelivered = useCallback(async () => {
    try {
      const r = await fetch("/api/vater/concierge/queue?include=delivered");
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load delivered"));
      const d = (await r.json()) as Fable5Queue;
      setDelivered(
        d.users
          .map((u) => ({ ...u, tickets: u.tickets.filter((t) => t.stage === "delivered") }))
          .filter((u) => u.tickets.length > 0),
      );
    } catch (err) {
      toast({ title: "Delivered list failed", description: err instanceof Error ? err.message : String(err), variant: "error" });
    }
  }, [toast]);

  useEffect(() => {
    if (showDelivered && delivered === null) void loadDelivered();
  }, [showDelivered, delivered, loadDelivered]);

  async function run(code: string, label: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(code);
    try {
      await fn();
      if (success) toast({ title: success, variant: "success" });
      await onRefresh();
      if (showDelivered) void loadDelivered();
    } catch (err) {
      toast({ title: `${label} failed`, description: err instanceof Error ? err.message : String(err), variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function copyText(text: string, title: string, description?: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title, description, variant: "success" });
    } catch {
      toast({ title: "Copy failed — select the text manually", variant: "error" });
    }
  }

  async function copyPack(t: Fable5Ticket) {
    setBusy(t.code);
    try {
      const r = await fetch(`/api/vater/concierge/${encodeURIComponent(t.code)}`);
      if (!r.ok) throw new Error(await readApiError(r, "Failed to load ticket"));
      const d = (await r.json()) as { pack?: string };
      if (!d.pack) throw new Error("ticket has no pack");
      await copyText(d.pack, `Pack copied — ${t.code}`, "Paste into Claude Code on the DGX, then run /fable5.");
    } catch (err) {
      toast({ title: "Copy pack failed", description: err instanceof Error ? err.message : String(err), variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  const counts = data?.counts ?? { queued: 0, in_progress: 0, needs_info: 0 };
  const users = data?.users ?? [];
  const liveUsers = users
    .map((u) => ({ ...u, tickets: u.tickets.filter((t) => t.stage !== "delivered") }))
    .filter((u) => u.tickets.length > 0);

  return (
    <div>
      <div className="panel" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>📜 Fable 5 Concierge — tickets waiting on a human.</div>
        <div style={{ fontSize: 11, color: "var(--hq-ink-2)" }}>
          <b>Copy pack</b> → paste into Claude Code on the DGX → <code>/fable5 F5-XXXXXX</code>. The buttons here are
          the manual levers for when the CLI isn&apos;t at hand. Refreshes every 30 s.
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <span className="pill" style={{ background: "#ede9fe", color: "#6d28d9" }}>{counts.queued} queued</span>
          <span className="pill" style={{ background: "#fef9c3", color: "#a16207" }}>{counts.in_progress} in progress</span>
          <span className="pill" style={{ background: "#fee2e2", color: "#b91c1c" }}>{counts.needs_info} needs info</span>
          <button className="btn btn-sm" onClick={() => void onRefresh()} disabled={loading}>
            ↻
          </button>
        </div>
      </div>

      <div
        className="panel"
        style={{ padding: "8px 14px", fontSize: 11, color: "#8a5300", background: "#fffbeb", borderColor: "#fde68a" }}
      >
        ⚠️ Don&apos;t use this tab while <b>&ldquo;view as user&rdquo;</b> is active on /animate — the proxy blocks every
        write under /api/vater for that cookie (403 <code>VIEW_AS_READ_ONLY</code>), so every button here would fail.
        Same price as Auto: the debit lands at the first <b>Sync</b> that sees a final video; repairs never re-debit.
      </div>

      {loading && !data ? (
        <div style={{ color: "#666", padding: 20 }}>Loading…</div>
      ) : liveUsers.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 28 }}>📜</div>
          <div style={{ fontWeight: 700, marginTop: 6 }}>No open Fable 5 tickets.</div>
          <div style={{ fontSize: 11, color: "var(--hq-ink-2)", marginTop: 2 }}>
            New tickets ping Telegram the moment a customer picks the Fable 5 engine.
          </div>
        </div>
      ) : (
        liveUsers.map((u) => (
          <UserGroup
            key={u.userId || "legacy"}
            user={u}
            busy={busy}
            onCopyPack={copyPack}
            onCopyCommand={(t) => copyText(`/fable5 ${t.code}`, `Command copied — /fable5 ${t.code}`)}
            onRun={run}
          />
        ))
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-sm" onClick={() => setShowDelivered((v) => !v)}>
          {showDelivered ? "▾" : "▸"} Recently delivered
        </button>
        {showDelivered &&
          (delivered === null ? (
            <div style={{ color: "#666", padding: 12, fontSize: 12 }}>Loading…</div>
          ) : delivered.length === 0 ? (
            <div style={{ color: "#666", padding: 12, fontSize: 12 }}>Nothing delivered yet.</div>
          ) : (
            delivered.map((u) => (
              <UserGroup
                key={`d-${u.userId || "legacy"}`}
                user={u}
                busy={busy}
                muted
                onCopyPack={copyPack}
                onCopyCommand={(t) => copyText(`/fable5 ${t.code}`, `Command copied — /fable5 ${t.code}`)}
                onRun={run}
              />
            ))
          ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-customer group
// ─────────────────────────────────────────────────────────────────────────────

function UserGroup({
  user,
  busy,
  muted,
  onCopyPack,
  onCopyCommand,
  onRun,
}: {
  user: Fable5User;
  busy: string | null;
  muted?: boolean;
  onCopyPack: (t: Fable5Ticket) => Promise<void>;
  onCopyCommand: (t: Fable5Ticket) => Promise<void>;
  onRun: (code: string, label: string, fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  return (
    <div className="panel" style={{ marginTop: 10, padding: "10px 14px", opacity: muted ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>{user.email || "(no email)"}</span>
        {user.name && <span style={{ fontSize: 12, color: "var(--hq-ink-2)" }}>{user.name}</span>}
        <span className="pill" style={{ background: "#f0f0f5", color: "#3a3a3c" }}>{user.tier}</span>
        <span
          className="pill"
          style={user.lane === "vater" ? { background: "#fce7f3", color: "#be185d" } : { background: "#ccfbf1", color: "#0f766e" }}
          title="Modal lane / invoice line"
        >
          lane {user.lane}
        </span>
        <span className="pill" style={{ background: "#dcfce7", color: "#15803d" }}>
          {user.unmetered ? "unmetered" : `balance ${usd(user.balanceUsd)}`}
        </span>
        <span className="pill" style={{ background: "#f0f0f5", color: "#3a3a3c" }}>
          cap {user.maxWords == null ? "∞" : `${user.maxWords} words`}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>{user.userId || "legacy"}</span>
      </div>
      {user.tickets.map((t) => (
        <TicketCard
          key={t.code}
          ticket={t}
          busy={busy === t.code}
          onCopyPack={() => onCopyPack(t)}
          onCopyCommand={() => onCopyCommand(t)}
          onRun={(label, fn, success) => onRun(t.code, label, fn, success)}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ticket card
// ─────────────────────────────────────────────────────────────────────────────

function TicketCard({
  ticket: t,
  busy,
  onCopyPack,
  onCopyCommand,
  onRun,
}: {
  ticket: Fable5Ticket;
  busy: boolean;
  onCopyPack: () => Promise<void>;
  onCopyCommand: () => Promise<void>;
  onRun: (label: string, fn: () => Promise<unknown>, success?: string) => Promise<void>;
}) {
  const [stage, setStage] = useState<ConciergeStage>(
    OPERATOR_STAGES.includes(t.stage) ? t.stage : "picked_up",
  );
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [gateMsg, setGateMsg] = useState<{ text: string; reportUrl: string | null } | null>(null);

  const terminal = TERMINAL.has(t.stage);
  const blockReason = terminal ? null : deliverBlockReason(t);
  const auditWarn = terminal ? null : deliverAuditWarning(t);
  const claimable = t.stage === "queued" || t.stage === "needs_info";
  const kickable = !terminal && !(t.jobId && (t.stage === "rendering" || t.stage === "qa"));
  const accent = STAGE_STYLE[t.stage]?.fg ?? "#9ca3af";

  function saveStage() {
    if (stage === "needs_info" && !note.trim()) {
      window.alert("needs_info needs a customer-visible note — it is what they read in the email.");
      return;
    }
    void onRun(
      "Stage",
      () =>
        postTicket(t.code, "stage", {
          stage,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(internalNote.trim() ? { internalNote: internalNote.trim() } : {}),
        }),
      `Stage → ${STAGE_STYLE[stage].label}`,
    ).then(() => {
      setNote("");
      setInternalNote("");
    });
  }

  function kickoff() {
    if (!window.confirm(`Kick off the render for ${t.code}? This starts a paid DGX/Modal job on the customer's lane.`)) return;
    void onRun("Kickoff", () => postTicket(t.code, "kickoff"), "Render kicked");
  }

  function sync() {
    void onRun(
      "Sync",
      async () => {
        const d = (await postTicket(t.code, "sync")) as { outcome?: string; project?: { status?: string; finalVideoUrl?: string | null } };
        return d;
      },
      "Synced",
    );
  }

  async function runDeliver(body: Record<string, unknown>, label: string) {
    setGateMsg(null);
    let gate: DeliverGateError | null = null;
    await onRun(
      label,
      async () => {
        try {
          return await postTicket(t.code, "deliver", body);
        } catch (err) {
          if (err instanceof DeliverGateError) {
            gate = err;
            return null; // swallowed here → rendered inline below, no toast
          }
          throw err;
        }
      },
      "Delivered ✓",
    );
    if (gate) {
      const g = gate as DeliverGateError;
      setGateMsg({ text: g.message, reportUrl: g.reportUrl });
    }
  }

  function deliver() {
    const n = window.prompt(`Deliver ${t.code} — note to the customer (optional):`, "");
    if (n === null) return;
    void runDeliver(n.trim() ? { note: n.trim() } : {}, "Deliver");
  }

  function deliverAnyway() {
    const why = window.prompt(
      `Deliver ${t.code} WITHOUT a passing audit?\n\n${blockReason ?? ""}\n\nReason (≥ 8 chars — stamped on the ticket + Telegram):`,
      "",
    );
    if (why === null) return;
    if (why.trim().length < 8) {
      setGateMsg({ text: "Waiver needs a reason of at least 8 characters.", reportUrl: null });
      return;
    }
    const n = window.prompt("Note to the customer (optional):", "");
    if (n === null) return;
    void runDeliver({ waive: true, waiveReason: why.trim(), ...(n.trim() ? { note: n.trim() } : {}) }, "Deliver (waiver)");
  }

  function cancel() {
    if (!window.confirm(`Cancel ${t.code}? The customer keeps the script (status → scripted).`)) return;
    const n = window.prompt("Reason for the customer (optional — emailed when given):", "");
    if (n === null) return;
    void onRun("Cancel", () => postTicket(t.code, "cancel", n.trim() ? { note: n.trim() } : {}), "Cancelled");
  }

  return (
    <div
      className="panel"
      style={{ borderLeft: `4px solid ${accent}`, marginBottom: 8, padding: "10px 12px", background: "#fafafc" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13 }}>{t.code}</span>
            <StagePill stage={t.stage} />
            {t.dgxPhase && (
              <span className="pill" style={{ background: "#1d1d1f", color: "#fff" }} title="DGX phase (last sync)">
                {t.dgxPhase}
              </span>
            )}
            <AuditChip audit={t.audit} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--hq-ink-2)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{t.words} words</span>
            <span>~{t.estMinutes} min</span>
            <span>est {usd(t.estimateUsd)}</span>
            <span title={t.submittedAt}>submitted {relativeTimeLabel(t.submittedAt) || "—"}</span>
            {t.claimedAt && (
              <span title={t.claimedAt}>
                claimed {relativeTimeLabel(t.claimedAt)}
                {t.claimedBy ? ` by ${t.claimedBy}` : ""}
              </span>
            )}
            {t.deliveredAt && <span title={t.deliveredAt}>delivered {relativeTimeLabel(t.deliveredAt)}</span>}
            {t.jobId && <span style={{ fontFamily: "monospace" }}>job {t.jobId}</span>}
            <span style={{ fontFamily: "monospace" }} title="project id">
              {t.projectId}
            </span>
          </div>
          {t.errorMessage && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#b91c1c", background: "#fee2e2", borderRadius: 6, padding: "4px 8px" }}>
              ⚠️ {t.errorMessage}
            </div>
          )}
          {t.customerNote && (
            <div style={{ marginTop: 6, fontSize: 11 }}>
              <b>Customer:</b> {t.customerNote}
            </div>
          )}
          {t.operatorNote && (
            <div style={{ marginTop: 4, fontSize: 11 }}>
              <b>Operator note (customer sees):</b> {t.operatorNote}
            </div>
          )}
          {t.internalNote && (
            <div style={{ marginTop: 4, fontSize: 11, color: "#6d28d9" }}>
              <b>Internal:</b> {t.internalNote}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void onCopyPack()} title="GET the ticket and copy the operator pack to the clipboard">
              📋 Copy pack
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => void onCopyCommand()}>
              ⌘ Copy command
            </button>
          </div>
          {!terminal && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {claimable && (
                <button className="btn btn-sm" disabled={busy} onClick={() => void onRun("Claim", () => postTicket(t.code, "claim"), "Claimed")}>
                  ✋ Claim
                </button>
              )}
              {kickable && (
                <button className="btn btn-sm" disabled={busy} onClick={kickoff} title="startRunCreation on the customer's style/voice/lane — spends money">
                  🚀 Kickoff
                </button>
              )}
              <button className="btn btn-sm" disabled={busy} onClick={sync} title="Pull DGX job state onto the project (idempotent)">
                🔄 Sync
              </button>
              <button
                className="btn btn-sm"
                disabled={busy || !!blockReason}
                onClick={deliver}
                title={blockReason ?? auditWarn ?? `Audit r${t.audit?.round} passed for this final — deliver (email + Telegram + status ready)`}
                data-testid="f5-deliver"
                style={
                  blockReason
                    ? { color: "#9ca3af", borderColor: "#e5e7eb", background: "#f9fafb", cursor: "not-allowed" }
                    : { color: "#15803d", borderColor: "#bbf7d0", background: "#f0fdf4" }
                }
              >
                ✅ Deliver
              </button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={cancel}>
                ✕ Cancel
              </button>
              <button className="btn btn-sm" onClick={() => setShowNotes((v) => !v)}>
                {showNotes ? "Hide" : "Stage / notes"}
              </button>
            </div>
          )}
          {!terminal && auditWarn && !blockReason && (
            <div data-testid="f5-audit-warning" style={{ fontSize: 11, color: "#a16207", maxWidth: 280, textAlign: "right" }}>
              ⚠️ {auditWarn}
            </div>
          )}
          {!terminal && blockReason && (
            <button
              type="button"
              disabled={busy}
              onClick={deliverAnyway}
              data-testid="f5-deliver-anyway"
              title={`${blockReason} Override with a written reason — stamped on history, the internal note and Telegram.`}
              style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: "#b91c1c", textDecoration: "underline", cursor: "pointer" }}
            >
              Deliver anyway…
            </button>
          )}
        </div>
      </div>

      {gateMsg && (
        <div
          data-testid="f5-deliver-gate"
          role="alert"
          style={{ marginTop: 8, fontSize: 11, color: "#b91c1c", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 6, padding: "6px 8px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <span>⛔ Not delivered — {gateMsg.text}</span>
          {gateMsg.reportUrl && (
            <a href={gateMsg.reportUrl} target="_blank" rel="noreferrer" style={{ color: "#b91c1c", fontWeight: 700 }}>
              open audit sheet ↗
            </a>
          )}
          <button type="button" onClick={() => setGateMsg(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: 11 }}>
            dismiss
          </button>
        </div>
      )}

      {!terminal && showNotes && (
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, alignItems: "start" }}>
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as ConciergeStage)}
            aria-label="Stage"
            style={{ padding: "5px 10px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#fff" }}
          >
            {CONCIERGE_STAGES.filter((s) => OPERATOR_STAGES.includes(s)).map((s) => (
              <option key={s} value={s}>
                {STAGE_STYLE[s].label}
              </option>
            ))}
          </select>
          <div style={{ display: "grid", gap: 6 }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Customer-visible note (required for Needs info — it is emailed)"
              rows={2}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, boxSizing: "border-box", fontFamily: "inherit" }}
            />
            <textarea
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="Internal note (never shown to the customer)"
              rows={1}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, boxSizing: "border-box", fontFamily: "inherit" }}
            />
            <div>
              <button className="btn btn-sm btn-primary" disabled={busy} onClick={saveStage}>
                Save stage / notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
