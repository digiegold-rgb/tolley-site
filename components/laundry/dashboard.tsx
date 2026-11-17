"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  LaundryOperator,
  LaundryLead,
  LaundryBooking,
  LaundryReview,
} from "@prisma/client";
import { money } from "@/lib/laundry/config";
import { authenticateBooking } from "./stripe-confirm";
import { OperatorForm } from "./operator-form";
type Lead = LaundryLead & {
  booking: LaundryBooking | null;
  review: LaundryReview | null;
  operator: { name: string; feeCents: number } | null;
};
type Data = {
  messages: {
    id: string;
    leadId: string | null;
    body: string;
    reply: string | null;
  }[];
  admin: boolean;
  operators: LaundryOperator[];
  leads: Lead[];
  cities: {
    city: string;
    state: string;
    leads: number;
    bookings: number;
    collected: number;
    refunded: number;
  }[];
  notifications: { status: string; _count: number }[];
  billingEnabled: boolean;
  notificationsEnabled: boolean;
};
export function Dashboard() {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState("all"),
    [tab, setTab] = useState("leads");
  async function load() {
    const r = await fetch("/api/laundry/dashboard");
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setData(b);
  }
  useEffect(() => {
    async function init() {
      try {
        const setup = new URLSearchParams(window.location.search).get("setup");
        if (setup) {
          const r = await fetch("/api/laundry/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sync_setup", session: setup }),
          });
          const b = await r.json();
          if (!r.ok) throw new Error(b.error);
          window.history.replaceState(null, "", "/laundry/dashboard");
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Dashboard unavailable.");
      }
    }
    void init();
  }, []);
  async function act(
    action: string,
    id: string,
    value?: string,
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/laundry/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, id, value, ...extra }),
        }),
        b = await r.json();
      if (!r.ok) throw new Error(b.error);
      if (b.requiresAction) {
        await authenticateBooking(b.clientSecret, b.publishableKey);
        await fetch("/api/laundry/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "retry_payment", id }),
        });
        await load();
      } else if (b.url) window.location.assign(b.url);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div>
        <p>{error || "Loading your workspace…"}</p>
        {error && (
          <a href="/login?callbackUrl=%2Flaundry%2Fdashboard">Sign in again</a>
        )}
      </div>
    );
  const leads = data.leads.filter(
    (l) => filter === "all" || l.status === filter,
  );
  return (
    <div className="stack">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        {[
          "leads",
          "operators",
          "billing",
          ...(data.admin ? ["cities"] : []),
        ].map((t) => (
          <button
            className={tab === t ? "" : "ghost"}
            key={t}
            onClick={() => setTab(t)}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button
          className="ghost"
          onClick={() => load().catch(() => setError("Could not refresh."))}
        >
          Refresh
        </button>
      </div>
      {data.admin && (
        <p className="tiny">
          Billing {data.billingEnabled ? "enabled" : "not activated"} ·
          Notifications{" "}
          {data.notificationsEnabled ? "enabled" : "not activated"} ·{" "}
          {data.notifications.map((n) => `${n._count} ${n.status}`).join(" · ")}
          . Inbox shows the latest 200 requests; city totals include all
          records.
        </p>
      )}
      {!data.operators.length && (
        <div className="card">
          <h2>Your operator account is ready.</h2>
          <p>Apply for a listing to start receiving requests.</p>
          <Link className="button" href="/laundry/join">
            Create your listing
          </Link>
        </div>
      )}
      {tab === "leads" && (
        <>
          <label style={{ maxWidth: 300 }}>
            Filter requests
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              {[
                "all",
                "requested",
                "accepted",
                "booked",
                "delivered",
                "declined",
                "expired",
                "waitlisted",
                "cancelled",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {!leads.length && (
            <div className="card">
              <h3>No requests here yet.</h3>
              <p>New signed requests will appear in this inbox.</p>
            </div>
          )}
          {leads.map((l) => (
            <article className="card" key={l.id}>
              <div className="section-head">
                <div>
                  <span className="badge">{l.status}</span>
                  <h3 style={{ marginTop: 14 }}>
                    {l.name} · {l.unit}
                  </h3>
                </div>
                <span className="muted">
                  {l.operator?.name || "Unassigned interest"}
                </span>
              </div>
              <p>
                {l.address}, {l.city}, {l.state} {l.zip}
                <br />
                <a href={`tel:${l.phone}`}>{l.phone}</a> ·{" "}
                <a href={`mailto:${l.email}`}>{l.email}</a>
                <br />
                Requested: {l.preferredDate}
                {l.deliveryDate && ` · Confirmed: ${l.deliveryDate}`}
              </p>
              {l.notes && <p>{l.notes}</p>}
              {data.messages
                .filter((m) => m.leadId === l.id)
                .map((m) => (
                  <div className="success" key={m.id}>
                    <p>Renter: {m.body}</p>
                    {m.reply && <p>T-Agent: {m.reply}</p>}
                  </div>
                ))}
              {l.agreementText && (
                <details>
                  <summary>Signed agreement</summary>
                  <pre className="agreement">
                    {l.agreementText}
                    {`\nSigned by ${l.signedName} at ${l.signedAt}`}
                  </pre>
                </details>
              )}
              <div className="actions">
                {l.status === "requested" && (
                  <>
                    <button disabled={busy} onClick={() => act("accept", l.id)}>
                      Accept · no charge
                    </button>
                    <button
                      className="ghost"
                      disabled={busy}
                      onClick={() => act("decline", l.id)}
                    >
                      Decline
                    </button>
                  </>
                )}
                {["accepted", "booked"].includes(l.status) && (
                  <form
                    className="actions"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act(
                        l.status === "accepted" ? "confirm" : "reschedule",
                        l.id,
                        String(f.get("day")),
                      );
                    }}
                  >
                    <label>
                      Agreed delivery date
                      <input
                        type="date"
                        name="day"
                        defaultValue={l.deliveryDate || l.preferredDate}
                        required
                      />
                    </label>
                    <button disabled={busy}>
                      {l.status === "accepted"
                        ? `Confirm delivery · ${money(l.operator?.feeCents || 0)}`
                        : "Reschedule · no extra fee"}
                    </button>
                  </form>
                )}
                {l.status === "booked" && (
                  <button
                    disabled={busy}
                    onClick={() => act("delivered", l.id)}
                  >
                    Mark delivered
                  </button>
                )}
              </div>
              {["requested", "accepted", "booked"].includes(l.status) && (
                <details>
                  <summary>Cancel or report a no-show</summary>
                  <p>
                    Cancel only if the delivery will not happen. A paid booking
                    fee will be queued for refund.
                  </p>
                  <div className="actions">
                    <button
                      className="ghost"
                      disabled={busy}
                      onClick={() => act("cancel", l.id)}
                    >
                      Confirm cancellation
                    </button>
                    {l.status === "booked" && (
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => act("no_show", l.id)}
                      >
                        Report no-show
                      </button>
                    )}
                  </div>
                </details>
              )}
              {l.booking && (
                <p className="tiny">
                  Booking fee: {money(l.booking.feeCents)} · {l.booking.status}
                </p>
              )}
              {data.admin && l.review && (
                <details>
                  <summary>Review moderation · {l.review.status}</summary>
                  <p>
                    {l.review.rating}/5 · {l.review.body}
                  </p>
                  <form
                    className="form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void act("moderate_review", l.review!.id, undefined, {
                        reason: f.get("reason"),
                        publish: l.review!.status !== "published",
                      });
                    }}
                  >
                    <label>
                      Moderation reason
                      <input
                        name="reason"
                        minLength={10}
                        required
                        maxLength={2000}
                      />
                    </label>
                    <button disabled={busy}>
                      {l.review.status === "published"
                        ? "Hide review"
                        : "Restore review"}
                    </button>
                  </form>
                </details>
              )}
            </article>
          ))}
        </>
      )}
      {tab === "operators" &&
        data.operators.map((op) => (
          <div className="card" key={op.id}>
            <h3>{op.name}</h3>
            <p>
              <span className="badge">{op.status}</span> ·{" "}
              {op.anchor
                ? "KC anchor — fee waived"
                : `${money(op.feeCents)} per booking`}{" "}
              · Card {op.paymentMethodId ? "saved" : "not saved"}
            </p>
            <p>
              {op.email} · {op.phone}
              {op.websiteRequested && " · Website quote requested"}
            </p>
            <div className="actions">
              {!op.anchor && (
                <button
                  disabled={busy || !data.billingEnabled}
                  onClick={() => act("setup", op.id)}
                >
                  {op.paymentMethodId
                    ? "Update billing card"
                    : "Save billing card"}
                </button>
              )}
              {data.admin && (
                <>
                  <button
                    disabled={busy || op.status === "approved"}
                    onClick={() => act("approve", op.id)}
                  >
                    Approve listing & terms
                  </button>
                  <button
                    className="ghost"
                    disabled={busy || op.status === "paused"}
                    onClick={() => act("pause", op.id)}
                  >
                    Pause listing
                  </button>
                </>
              )}
            </div>
            <details>
              <summary>Edit pricing, coverage and rental terms</summary>
              <OperatorForm op={op} />
            </details>
          </div>
        ))}
      {tab === "billing" && (
        <>
          <p>
            Accepting a request is free. A fee is created once when delivery is
            confirmed. Failed charges and refunds remain visible here.
          </p>
          {data.leads
            .filter((l) => l.booking)
            .map((l) => {
              const b = l.booking!;
              return (
                <div key={b.id} className="card">
                  <h3>
                    {l.name} · {money(b.feeCents)}
                  </h3>
                  <p>
                    {l.operator?.name} · {l.deliveryDate} ·{" "}
                    <strong>{b.status}</strong>
                  </p>
                  <p className="tiny">
                    Receipt: {b.id}
                    {b.paidAt &&
                      ` · Paid ${new Date(b.paidAt).toLocaleDateString()}`}
                    {b.refundedAt &&
                      ` · Refunded ${new Date(b.refundedAt).toLocaleDateString()}`}
                  </p>
                  {b.status === "payment_failed" && (
                    <button
                      disabled={busy}
                      onClick={() => act("retry_payment", b.id)}
                    >
                      Retry with saved card
                    </button>
                  )}
                  <p>
                    {b.disputeReason &&
                      `Dispute: ${b.disputeReason} (${b.disputeStatus})`}
                  </p>
                  {b.feeCents > 0 && !b.refundedAt && (
                    <details>
                      <summary>Dispute booking fee</summary>
                      <form
                        className="form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void act("dispute", l.id, String(f.get("reason")));
                        }}
                      >
                        <label>
                          What happened?
                          <textarea
                            name="reason"
                            required
                            minLength={10}
                            maxLength={2000}
                          />
                        </label>
                        <button disabled={busy}>Submit dispute</button>
                      </form>
                    </details>
                  )}
                  {data.admin && b.disputeStatus === "open" && (
                    <div className="actions">
                      <button
                        disabled={busy}
                        onClick={() => act("refund", b.id)}
                      >
                        Approve refund
                      </button>
                      <button
                        className="ghost"
                        disabled={busy}
                        onClick={() => act("reject_dispute", b.id)}
                      >
                        Reject dispute
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
        </>
      )}
      {tab === "cities" && (
        <div className="card table-scroll">
          <h2>Market performance</h2>
          <p className="muted">
            Collected booking fees and refunds only. KC anchor rental income is
            not marketplace revenue.
          </p>
          <table>
            <thead>
              <tr>
                <th>City</th>
                <th>Requests</th>
                <th>Bookings</th>
                <th>Collected</th>
                <th>Refunded</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {data.cities.map((c) => (
                <tr key={`${c.city}-${c.state}`}>
                  <td>
                    {c.city}, {c.state}
                  </td>
                  <td>{c.leads}</td>
                  <td>{c.bookings}</td>
                  <td>{money(c.collected)}</td>
                  <td>{money(c.refunded)}</td>
                  <td>{money(c.collected - c.refunded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
