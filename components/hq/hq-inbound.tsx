"use client";

import { useMemo, useState } from "react";

import { INBOUND_STATUS_LABEL, type HqInboundLead } from "./types";
import { crossSell } from "@/lib/directory";
import { draftInboundReply } from "@/lib/inbound-reply-draft";

interface Props {
  leads: HqInboundLead[];
  counts: Record<string, number>;
  loading: boolean;
  busyId: string | null;
  onRefresh: () => void;
  onAdvance: (id: string, status: string) => void;
  onNote: (id: string, note: string) => Promise<boolean>;
  onReply: (id: string, subject: string, body: string) => Promise<boolean>;
}

const LADDER = ["new", "acknowledged", "contacted", "quoted", "won", "lost"];
const NEXT_STEP: Record<string, { status: string; label: string }[]> = {
  new: [
    { status: "acknowledged", label: "Start working" },
    { status: "lost", label: "Dismiss" },
  ],
  acknowledged: [
    { status: "contacted", label: "Mark contacted" },
    { status: "lost", label: "Lost" },
  ],
  contacted: [
    { status: "quoted", label: "Mark quoted" },
    { status: "lost", label: "Lost" },
  ],
  quoted: [
    { status: "won", label: "Won 🎉" },
    { status: "lost", label: "Lost" },
  ],
  won: [],
  lost: [{ status: "new", label: "Reopen" }],
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** The subsite a lead came in on → a couple of sibling services to upsell. */
function crossSellHint(subsite: string): string[] {
  return crossSell(subsite, 2).map((e) => e.title);
}

function LeadCard({
  lead,
  busy,
  onAdvance,
  onNote,
  onReply,
  defaultUpsell,
}: {
  lead: HqInboundLead;
  busy: boolean;
  /** Hint already shown once above the board — suppressed on the cards. */
  defaultUpsell: string;
  onAdvance: (id: string, status: string) => void;
  onNote: (id: string, note: string) => Promise<boolean>;
  onReply: (id: string, subject: string, body: string) => Promise<boolean>;
}) {
  const [note, setNote] = useState(lead.statusNote ?? "");
  const [editing, setEditing] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyArmed, setReplyArmed] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [approveState, setApproveState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [approveMsg, setApproveMsg] = useState("");
  const fields = lead.structured ?? {};
  // Jelly Studio invite requests (from /animate) and Listing Studio ones
  // (from /realestateanimated, subsite "realestate") get a one-click approve:
  // mints an email-locked code, emails the signup link for THAT front door,
  // marks the row won.
  const isInviteRequest =
    (lead.subsite === "animate" || lead.subsite === "realestate") &&
    lead.action === "invite-request" &&
    !!lead.email;
  const inviteProduct = lead.subsite === "realestate" ? "realestate" : "jelly";
  const canApprove = isInviteRequest && lead.status !== "won" && lead.status !== "lost";
  const approveInvite = async () => {
    if (!lead.email) return;
    setApproveState("sending");
    try {
      const r = await fetch("/api/hq/vater-users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mint-invite", count: 1, email: lead.email, send: true, product: inviteProduct }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        sent?: boolean;
        sendError?: string | null;
        error?: string;
        message?: string;
        invites?: Array<{ display: string; link: string }>;
      };
      if (!r.ok) {
        setApproveState("error");
        setApproveMsg(data.message || data.error || `HTTP ${r.status}`);
        return;
      }
      if (data.sent) {
        setApproveState("sent");
        setApproveMsg(`Invite ${data.invites?.[0]?.display ?? ""} emailed to ${lead.email}`);
        onAdvance(lead.id, "won");
      } else {
        setApproveState("error");
        setApproveMsg(`Minted but email FAILED: ${data.sendError ?? "unknown"} — link: ${data.invites?.[0]?.link ?? "?"}`);
      }
    } catch (err) {
      setApproveState("error");
      setApproveMsg(err instanceof Error ? err.message : "network error");
    }
  };
  const upsellText = crossSellHint(lead.subsite).join(", ");
  const canReply = !!lead.email && lead.status !== "won" && lead.status !== "lost";

  const openReply = () => {
    if (!replyOpen) {
      const draft = draftInboundReply(lead);
      setReplySubject(draft.subject);
      setReplyBody(draft.body);
    }
    setReplyArmed(false);
    setReplyOpen(!replyOpen);
  };

  return (
    <div
      style={{
        border: "1px solid var(--hq-line)",
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 13 }}>
            {lead.name || lead.email || lead.phone || "Anonymous"}
          </span>
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "#5f6368",
              background: "#f1f3f4",
              borderRadius: 6,
              padding: "2px 7px",
            }}
          >
            {lead.subsite} · {lead.action}
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#999", whiteSpace: "nowrap" }}>
          {timeAgo(lead.createdAt)}
        </span>
      </div>

      {/* contact */}
      <div style={{ marginTop: 6, fontSize: 12, color: "#444" }}>
        {[lead.phone, lead.email].filter(Boolean).join(" · ") || "no contact info"}
      </div>

      {/* structured fields */}
      {Object.keys(fields).length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#333", lineHeight: 1.5 }}>
          {Object.entries(fields).map(([k, v]) => (
            <div key={k}>
              <span style={{ color: "#888" }}>{k}:</span> {String(v)}
            </div>
          ))}
        </div>
      )}

      {/* Cross-sell hint (HQ-08). The hint is derived from the subsite, so when
          every lead arrives on the same one this printed an identical line on
          every card and became invisible furniture. The shared hint is shown
          once above the board; a card only speaks up when its own differs. */}
      {upsellText && upsellText !== defaultUpsell && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#137333" }}>
          ↗ Upsell idea: {upsellText}
        </div>
      )}

      {/* note */}
      {editing ? (
        <div style={{ marginTop: 8 }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            style={{ width: "100%", fontSize: 12, padding: 6, border: "1px solid var(--hq-border)", borderRadius: 6, boxSizing: "border-box" }}
            placeholder="Note (what you quoted, next step…)"
          />
          <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
            <button
              className="btn btn-sm btn-primary"
              disabled={busy}
              onClick={async () => {
                if (await onNote(lead.id, note)) setEditing(false);
              }}
            >
              Save note
            </button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 12 }}>
          {lead.statusNote ? (
            <span style={{ color: "#555" }}>📝 {lead.statusNote} </span>
          ) : null}
          <button
            onClick={() => setEditing(true)}
            style={{ fontSize: 11, color: "#1a73e8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {lead.statusNote ? "edit" : "+ add note"}
          </button>
        </div>
      )}

      {/* reply — pre-drafted in Jared's voice; nothing sends until the
          armed confirm button is tapped */}
      {replyOpen && (
        <div style={{ marginTop: 8, border: "1px solid var(--hq-border)", borderRadius: 8, padding: 8, background: "#fafafa" }}>
          <input
            value={replySubject}
            onChange={(e) => setReplySubject(e.target.value)}
            style={{ width: "100%", fontSize: 12, padding: 6, border: "1px solid var(--hq-border)", borderRadius: 6, boxSizing: "border-box", marginBottom: 6 }}
            placeholder="Subject"
          />
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={8}
            style={{ width: "100%", fontSize: 12, padding: 6, border: "1px solid var(--hq-border)", borderRadius: 6, boxSizing: "border-box", fontFamily: "inherit" }}
          />
          <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
            {replyArmed ? (
              <button
                className="btn btn-sm btn-primary"
                disabled={replySending || !replySubject.trim() || !replyBody.trim()}
                style={{ background: "#c5221f", borderColor: "#c5221f" }}
                onClick={async () => {
                  setReplySending(true);
                  const ok = await onReply(lead.id, replySubject, replyBody);
                  setReplySending(false);
                  if (ok) setReplyOpen(false);
                  setReplyArmed(false);
                }}
              >
                {replySending ? "Sending…" : `Really send to ${lead.email}`}
              </button>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                disabled={!replySubject.trim() || !replyBody.trim()}
                onClick={() => setReplyArmed(true)}
              >
                Send reply
              </button>
            )}
            <button className="btn btn-sm" onClick={() => { setReplyOpen(false); setReplyArmed(false); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* actions */}
      {approveMsg && (
        <div style={{ marginTop: 6, fontSize: 12, color: approveState === "error" ? "#c5221f" : "#0f766e" }}>
          {approveMsg}
        </div>
      )}
      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {canApprove && approveState !== "sent" && (
          <button
            className="btn btn-sm btn-primary"
            disabled={busy || approveState === "sending"}
            style={{ background: "#0f766e", borderColor: "#0f766e" }}
            title="Mint an email-locked Jelly Studio invite and email them the signup link"
            onClick={approveInvite}
          >
            {approveState === "sending" ? "Sending invite…" : "🎟 Approve → mint + email invite"}
          </button>
        )}
        {canReply && (
          <button className="btn btn-sm" disabled={busy} onClick={openReply}>
            {replyOpen ? "Hide reply" : "✉️ Reply"}
          </button>
        )}
        {(NEXT_STEP[lead.status] ?? []).map((step) => (
          <button
            key={step.status}
            className={`btn btn-sm${step.status === "won" ? " btn-primary" : ""}`}
            disabled={busy}
            onClick={() => onAdvance(lead.id, step.status)}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function HqInbound({ leads, counts, loading, busyId, onRefresh, onAdvance, onNote, onReply }: Props) {
  const [subsiteFilter, setSubsiteFilter] = useState("all");

  const subsites = useMemo(
    () => Array.from(new Set(leads.map((l) => l.subsite))).sort(),
    [leads],
  );
  const filtered =
    subsiteFilter === "all" ? leads : leads.filter((l) => l.subsite === subsiteFilter);

  const byStatus = (s: string) => filtered.filter((l) => l.status === s);

  // HQ-08: the single hint most leads on this board share. Shown once below the
  // header; cards suppress it and only print their own when it differs. Needs a
  // real majority — with a mixed board every card's hint is still news.
  const defaultUpsell = useMemo(() => {
    if (filtered.length < 2) return "";
    const tally = new Map<string, number>();
    for (const l of filtered) {
      const hint = crossSellHint(l.subsite).join(", ");
      if (hint) tally.set(hint, (tally.get(hint) ?? 0) + 1);
    }
    let best = "";
    let bestN = 0;
    for (const [hint, n] of tally) {
      if (n > bestN) { best = hint; bestN = n; }
    }
    return bestN > filtered.length / 2 ? best : "";
  }, [filtered]);

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Inbound leads</span>
        <select
          value={subsiteFilter}
          onChange={(e) => setSubsiteFilter(e.target.value)}
          style={{ padding: "4px 8px", border: "1px solid var(--hq-border)", borderRadius: 8, fontSize: 12, background: "#fff" }}
        >
          <option value="all">All products</option>
          {subsites.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={onRefresh} style={{ marginLeft: "auto" }}>
          ↻ Refresh
        </button>
      </div>

      {defaultUpsell && !loading && filtered.length > 0 && (
        <div style={{ marginBottom: 10, fontSize: 11, color: "#137333" }}>
          ↗ Upsell idea for most of these: {defaultUpsell}
          <span style={{ color: "var(--hq-ink-3)" }}> — cards below only note it when theirs differs.</span>
        </div>
      )}

      {loading ? (
        <div style={{ color: "#888", fontSize: 13, padding: 16 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: "#888", fontSize: 13, padding: 16 }}>
          No inbound leads yet. Quote requests from every product land here.
        </div>
      ) : (
        <div className="inbound-board">
          {LADDER.map((status) => {
            const rows = byStatus(status);
            if (rows.length === 0 && status !== "new") return null;
            return (
              <div key={status} className="inbound-col">
                <div className="inbound-col-head">
                  {INBOUND_STATUS_LABEL[status] ?? status} ({rows.length})
                </div>
                {rows.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    defaultUpsell={defaultUpsell}
                    busy={busyId === lead.id}
                    onAdvance={onAdvance}
                    onNote={onNote}
                    onReply={onReply}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
