"use client";

import type { HqMoney } from "./types";

interface Props {
  money: HqMoney | null;
  loading: boolean;
  onRefresh: () => void;
}

function usd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DUNNING_LABEL: Record<number, string> = {
  0: "ok",
  1: "day 0",
  2: "day 3",
  3: "day 7+",
};

// Money tab — Engine 5 consolidation. Read-only: every W/D row links to
// /wd/admin where the actual approve/send buttons live.
export function HqMoney({ money, loading, onRefresh }: Props) {
  if (!money) {
    return (
      <div className="panel">
        <div style={{ fontSize: 13, color: "#999", padding: "8px 0" }}>
          {loading ? "Loading money data…" : "No money data loaded."}
        </div>
      </div>
    );
  }

  const { wd, invoices, week } = money;

  return (
    <div>
      {/* ─── This week strip ─── */}
      <div className="stat-row" style={{ marginTop: 0 }}>
        <div className="stat-card accent-green" style={{ minWidth: 130 }}>
          <h4>Collected (7d)</h4>
          <div className="val">{usd(week.totalRevenue)}</div>
        </div>
        <div className="stat-card">
          <h4>W/D (7d)</h4>
          <div className="val" style={{ fontSize: 15 }}>
            {usd(week.wdRevenue)}{" "}
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6e6e73" }}>
              · {week.wdPayments} pmts
            </span>
          </div>
        </div>
        <div className="stat-card">
          <h4>Invoices (7d)</h4>
          <div className="val" style={{ fontSize: 15 }}>
            {usd(week.invoiceRevenue)}{" "}
            <span style={{ fontSize: 11, fontWeight: 600, color: "#6e6e73" }}>
              · {week.invoicePayments} pmts
            </span>
          </div>
        </div>
        <div className="stat-card accent-purple">
          <h4>New Leads (7d)</h4>
          <div className="val">{week.newLeads}</div>
        </div>
        {money.animate && (
          <div className="stat-card">
            <h4>Animate Studio (mo)</h4>
            <div className="val" style={{ fontSize: 15 }}>
              {usd(money.animate.monthRevenue)}{" "}
              <span style={{ fontSize: 11, fontWeight: 600, color: "#6e6e73" }}>
                · {money.animate.monthActions} renders · {money.animate.videoOfferClients} video client
                {money.animate.videoOfferClients === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        )}
        <div style={{ marginLeft: "auto", alignSelf: "center" }}>
          <button className="btn btn-sm" onClick={onRefresh} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ─── W/D section ─── */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Washer/Dryer{" "}
            <span style={{ fontWeight: 600, fontSize: 12, color: "#6e6e73" }}>
              {wd.pastDue.length} past due ({usd(wd.pastDueTotal)} behind) · {wd.pendingApproval.length} pending
              approval · {wd.draftCount} message draft{wd.draftCount === 1 ? "" : "s"}
            </span>
          </div>
          <a className="btn btn-sm btn-primary" href="/wd/admin" style={{ textDecoration: "none" }}>
            Open /wd/admin →
          </a>
        </div>

        {/* Past due */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#b91c1c", margin: "8px 0 4px" }}>
          Past due — {wd.pastDue.length} client{wd.pastDue.length === 1 ? "" : "s"}, {usd(wd.pastDueTotal)} behind
        </div>
        {wd.pastDue.length === 0 ? (
          <div style={{ fontSize: 13, color: "#999", padding: "4px 0" }}>
            Nobody past due. Cash floor holding.
          </div>
        ) : (
          wd.pastDue.map((c) => (
            <a
              key={c.id}
              href="/wd/admin"
              style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #eef0f2", padding: "7px 0", textDecoration: "none", color: "inherit", flexWrap: "wrap" }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 140 }}>{c.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>
                {usd(c.amountBehind)} behind
              </span>
              <span style={{ fontSize: 11, color: "#6e6e73" }}>
                {c.missedCount} missed · ${c.unitCost}/mo
              </span>
              {c.dunningStage > 0 && (
                <span className="pill pill-status-discarded">
                  dunning {DUNNING_LABEL[c.dunningStage] ?? `stage ${c.dunningStage}`}
                </span>
              )}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#4472c4", fontWeight: 600 }}>
                /wd/admin →
              </span>
            </a>
          ))
        )}

        {/* Pending approval */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#a16207", margin: "14px 0 4px" }}>
          Pending approval — {wd.pendingApproval.length} signup{wd.pendingApproval.length === 1 ? "" : "s"}
        </div>
        {wd.pendingApproval.length === 0 ? (
          <div style={{ fontSize: 13, color: "#999", padding: "4px 0" }}>
            No signups waiting for approval.
          </div>
        ) : (
          wd.pendingApproval.map((c) => (
            <a
              key={c.id}
              href="/wd/admin"
              style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #eef0f2", padding: "7px 0", textDecoration: "none", color: "inherit", flexWrap: "wrap" }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 140 }}>{c.name}</span>
              <span style={{ fontSize: 11, color: "#6e6e73" }}>
                ${c.unitCost}/mo · signed up {shortDate(c.createdAt)}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#4472c4", fontWeight: 600 }}>
                approve in /wd/admin →
              </span>
            </a>
          ))
        )}

        {/* Drafts */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#3a3a3c", margin: "14px 0 4px" }}>
          Message drafts
        </div>
        <a
          href="/wd/admin"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", textDecoration: "none", color: "inherit" }}
        >
          <span className="pill pill-status-draft">{wd.draftCount} draft{wd.draftCount === 1 ? "" : "s"}</span>
          <span style={{ fontSize: 12, color: "#6e6e73" }}>
            reminders, dunning + AI replies awaiting 1-tap send
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#4472c4", fontWeight: 600 }}>
            /wd/admin →
          </span>
        </a>
      </div>

      {/* ─── Invoices section ─── */}
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Open invoices{" "}
            <span style={{ fontWeight: 600, fontSize: 12, color: "#6e6e73" }}>
              {invoices.open.length} open · {usd(invoices.totalDue)} due
              {invoices.overdueDue > 0 ? ` · ${usd(invoices.overdueDue)} overdue` : ""}
            </span>
          </div>
        </div>

        {invoices.open.length === 0 ? (
          <div style={{ fontSize: 13, color: "#999", padding: "4px 0" }}>
            No open invoices. Everything collected.
          </div>
        ) : (
          invoices.open.map((inv) => (
            <div
              key={inv.id}
              style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid #eef0f2", padding: "7px 0", flexWrap: "wrap" }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 80 }}>{inv.invoiceNumber}</span>
              <span style={{ fontSize: 12, color: "#3a3a3c", minWidth: 130 }}>
                {inv.contactName ?? "—"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{usd(inv.amountDue)}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: inv.isOverdue ? 700 : 400,
                  color: inv.isOverdue ? "#b91c1c" : "#6e6e73",
                }}
              >
                due {shortDate(inv.dueDate)}
                {inv.isOverdue ? " · OVERDUE" : ""}
              </span>
              <span
                className={`pill ${inv.isOverdue ? "pill-status-discarded" : "pill-status-sent"}`}
                style={{ marginLeft: "auto" }}
              >
                {inv.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
