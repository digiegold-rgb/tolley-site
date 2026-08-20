"use client";

/**
 * HqJellyPnl — the Jelly Studio (/animate) customer P&L on the /hq Money tab.
 *
 * Two jobs, in this order:
 *   1. Is the customer side making money? The summary block.
 *   2. A customer is disputing a charge — show me exactly how their number was
 *      built. Expand their row for per-video `compute + minutes × ops rate`,
 *      the pre-render estimate, and any cap or refund.
 *
 * Scope is CUSTOMERS ONLY. Trey's and Jared's renders are house business and
 * live on HqVaterDue; mixing them here would make the margin meaningless.
 *
 * ⚠️ The headline to read is NET MARGIN, not "cash in". Credits are prepaid,
 * so cash received is mostly a liability until videos are delivered — the
 * card labels it that way on purpose.
 */

import { Fragment, useCallback, useEffect, useState } from "react";

interface VideoLine {
  projectId: string;
  title: string;
  chargedAt: string;
  minutes: number;
  computeUsd: number;
  opsRate: number;
  opsUsd: number;
  chargedUsd: number;
  estimateUsd: number;
  cappedAtUsd: number | null;
  computeNowUsd: number;
  refundedUsd: number;
}

interface Customer {
  userId: string;
  email: string | null;
  cashInUsd: number;
  grantedUsd: number;
  deliveredUsd: number;
  refundedUsd: number;
  balanceUsd: number;
  balancePurchasedUsd: number;
  balanceGrantUsd: number;
  videos: VideoLine[];
}

interface Pnl {
  window: { from: string | null; to: string; days: number | null };
  opsRate: number;
  cashInUsd: number;
  stripeFeesUsd: number;
  grossSalesUsd: number;
  deliveredUsd: number;
  computeRecoveredUsd: number;
  opsMarginUsd: number;
  computeActualUsd: number;
  computeVarianceUsd: number;
  cappedLossUsd: number;
  promoBurnUsd: number;
  refundsUsd: number;
  netMarginUsd: number;
  deferredUsd: number;
  deferredPurchasedUsd: number;
  outstandingGrantUsd: number;
  videosDelivered: number;
  minutesDelivered: number;
  marginPerMinuteUsd: number;
  customers: Customer[];
  ready: boolean;
  error?: string;
}

const money = (n: number) =>
  n < 0 ? `-$${Math.abs(n).toFixed(2)}` : `$${n.toFixed(2)}`;

const shortDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const CARD: React.CSSProperties = {
  border: "1px solid var(--hq-border)",
  borderRadius: 10,
  padding: 14,
  marginBottom: 14,
  background: "var(--hq-card, #fff)",
};

const CELL: React.CSSProperties = {
  padding: "7px 9px",
  verticalAlign: "top",
  borderTop: "1px solid var(--hq-border)",
};

/** One labelled figure in the summary block. */
function Line({
  label,
  value,
  hint,
  strong,
  negative,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "3px 0",
        borderTop: strong ? "1px solid var(--hq-border)" : undefined,
        marginTop: strong ? 4 : undefined,
        paddingTop: strong ? 6 : 3,
      }}
    >
      <span style={{ color: strong ? undefined : "var(--hq-muted)", fontWeight: strong ? 700 : 400 }}>
        {label}
        {hint ? (
          <span style={{ color: "var(--hq-muted)", fontSize: 11 }}> — {hint}</span>
        ) : null}
      </span>
      <span
        style={{
          fontVariantNumeric: "tabular-nums",
          fontWeight: strong ? 700 : 600,
          color: negative ? "var(--hq-red, #b42318)" : undefined,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function HqJellyPnl() {
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const [openUser, setOpenUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(null);
    try {
      const qs = days ? `?days=${days}` : "";
      const r = await fetch(`/api/hq/jelly-pnl${qs}`, { cache: "no-store" });
      if (!r.ok) {
        // 401 = PIN not entered on this browser; the rest of /hq handles it.
        if (r.status !== 401) setFailed(`P&L failed (${r.status})`);
        setPnl(null);
        return;
      }
      setPnl((await r.json()) as Pnl);
    } catch {
      setFailed("P&L unreachable");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={CARD}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>Jelly Studio P&amp;L</div>
          <div style={{ color: "var(--hq-muted)", fontSize: 11 }}>
            /animate customers only — Trey&apos;s and Jared&apos;s renders are house
            business (see Vater due). Compute is passed through at cost, so the
            margin is the ${pnl?.opsRate?.toFixed(2) ?? "0.35"}/min ops fee.
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([null, 30, 7] as const).map((d) => (
            <button
              key={String(d)}
              type="button"
              onClick={() => setDays(d)}
              style={{
                padding: "3px 8px",
                fontSize: 11,
                borderRadius: 6,
                border: "1px solid var(--hq-border)",
                background: days === d ? "var(--hq-accent, #111)" : "#fff",
                color: days === d ? "#fff" : undefined,
                cursor: "pointer",
              }}
            >
              {d ? `${d}d` : "All time"}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <div style={{ color: "var(--hq-red, #b42318)", fontSize: 12 }}>
          {failed} — numbers below are NOT current.
        </div>
      ) : null}

      {loading && !pnl ? (
        <div style={{ color: "var(--hq-muted)", fontSize: 12 }}>Loading…</div>
      ) : null}

      {pnl && !pnl.ready ? (
        <div style={{ color: "var(--hq-red, #b42318)", fontSize: 12 }}>
          Credit ledger not readable — this is &quot;unknown&quot;, not $0.
        </div>
      ) : null}

      {pnl?.ready ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 18,
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.4, marginBottom: 4 }}>
                CASH IN
              </div>
              <Line label="Gross customer sales" value={money(pnl.grossSalesUsd)} />
              <Line label="Stripe fees" value={money(-pnl.stripeFeesUsd)} negative={pnl.stripeFeesUsd > 0} />
              <Line label="Cash received" value={money(pnl.cashInUsd)} strong />

              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.4, margin: "12px 0 4px" }}>
                EARNED
              </div>
              <Line
                label="Credits consumed"
                hint={`${pnl.videosDelivered} video${pnl.videosDelivered === 1 ? "" : "s"}, ${pnl.minutesDelivered.toFixed(1)} min`}
                value={money(pnl.deliveredUsd)}
              />
              <Line label="…compute, at cost" hint="recovered, not margin" value={money(pnl.computeRecoveredUsd)} />
              <Line label="…ops fee" hint="gross margin" value={money(pnl.opsMarginUsd)} strong />
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.4, marginBottom: 4 }}>
                AGAINST THAT MARGIN
              </div>
              <Line
                label="Compute variance"
                hint="spend booked after billing"
                value={money(-pnl.computeVarianceUsd)}
                negative={pnl.computeVarianceUsd > 0}
              />
              <Line
                label="Lost to 3× repair cap"
                value={money(-pnl.cappedLossUsd)}
                negative={pnl.cappedLossUsd > 0}
              />
              <Line
                label="Promo grants consumed"
                hint="free videos"
                value={money(-pnl.promoBurnUsd)}
                negative={pnl.promoBurnUsd > 0}
              />
              <Line label="Refunds" value={money(-pnl.refundsUsd)} negative={pnl.refundsUsd > 0} />
              <Line
                label="NET MARGIN"
                hint={`${money(pnl.marginPerMinuteUsd)}/min`}
                value={money(pnl.netMarginUsd)}
                strong
                negative={pnl.netMarginUsd < 0}
              />

              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.4, margin: "12px 0 4px" }}>
                LIABILITY
              </div>
              <Line
                label="Deferred — customer paid"
                hint="real, refundable"
                value={money(pnl.deferredPurchasedUsd)}
              />
              <Line
                label="Outstanding promo grant"
                hint="not owed"
                value={money(pnl.outstandingGrantUsd)}
              />
            </div>
          </div>

          <div style={{ marginTop: 14, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--hq-muted)", fontSize: 11 }}>
                  <th style={{ padding: "6px 9px" }}>Customer</th>
                  <th style={{ padding: "6px 9px" }}>Paid in</th>
                  <th style={{ padding: "6px 9px" }}>Granted</th>
                  <th style={{ padding: "6px 9px" }}>Delivered</th>
                  <th style={{ padding: "6px 9px" }}>Balance</th>
                  <th style={{ padding: "6px 9px" }}>Videos</th>
                </tr>
              </thead>
              <tbody>
                {pnl.customers.length === 0 ? (
                  <tr>
                    <td style={{ ...CELL, color: "var(--hq-muted)" }} colSpan={6}>
                      No customer accounts yet.
                    </td>
                  </tr>
                ) : (
                  pnl.customers.map((c) => (
                    // Fragment needs the key, not the rows inside it — a bare
                    // <> in a map re-keys nothing and React warns.
                    <Fragment key={c.userId}>
                      <tr>
                        <td style={CELL}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenUser(openUser === c.userId ? null : c.userId)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              padding: 0,
                              font: "inherit",
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            aria-expanded={openUser === c.userId}
                          >
                            {openUser === c.userId ? "▾ " : "▸ "}
                            {c.email ?? c.userId}
                          </button>
                        </td>
                        <td style={CELL}>{money(c.cashInUsd)}</td>
                        <td style={CELL}>{money(c.grantedUsd)}</td>
                        <td style={CELL}>{money(c.deliveredUsd)}</td>
                        <td style={CELL}>
                          {money(c.balanceUsd)}
                          <div style={{ color: "var(--hq-muted)", fontSize: 11 }}>
                            paid {money(c.balancePurchasedUsd)} · promo{" "}
                            {money(c.balanceGrantUsd)}
                          </div>
                        </td>
                        <td style={CELL}>{c.videos.length}</td>
                      </tr>
                      {openUser === c.userId ? (
                        <tr>
                          <td style={{ ...CELL, background: "var(--hq-subtle, #fafafa)" }} colSpan={6}>
                            {c.videos.length === 0 ? (
                              <span style={{ color: "var(--hq-muted)" }}>
                                No charged videos — their balance is untouched.
                              </span>
                            ) : (
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                  <tr style={{ textAlign: "left", color: "var(--hq-muted)" }}>
                                    <th style={{ padding: "4px 6px" }}>Charged</th>
                                    <th style={{ padding: "4px 6px" }}>Video</th>
                                    <th style={{ padding: "4px 6px" }}>Min</th>
                                    <th style={{ padding: "4px 6px" }}>Compute</th>
                                    <th style={{ padding: "4px 6px" }}>Ops fee</th>
                                    <th style={{ padding: "4px 6px" }}>Charged</th>
                                    <th style={{ padding: "4px 6px" }}>Estimate</th>
                                    <th style={{ padding: "4px 6px" }}>Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.videos.map((v) => (
                                    <tr key={`${v.projectId}-${v.chargedAt}`}>
                                      <td style={{ padding: "4px 6px" }}>{shortDateTime(v.chargedAt)}</td>
                                      <td style={{ padding: "4px 6px" }}>{v.title}</td>
                                      <td style={{ padding: "4px 6px" }}>{v.minutes.toFixed(2)}</td>
                                      <td style={{ padding: "4px 6px" }}>{money(v.computeUsd)}</td>
                                      <td style={{ padding: "4px 6px" }}>
                                        {money(v.opsUsd)}
                                        <span style={{ color: "var(--hq-muted)" }}>
                                          {" "}
                                          ({v.minutes.toFixed(2)}×${v.opsRate.toFixed(2)})
                                        </span>
                                      </td>
                                      <td style={{ padding: "4px 6px", fontWeight: 700 }}>
                                        {money(v.chargedUsd)}
                                      </td>
                                      <td style={{ padding: "4px 6px", color: "var(--hq-muted)" }}>
                                        {money(v.estimateUsd)}
                                      </td>
                                      <td style={{ padding: "4px 6px" }}>
                                        {v.cappedAtUsd !== null ? (
                                          <span style={{ color: "var(--hq-red, #b42318)" }}>
                                            capped at {money(v.cappedAtUsd)}{" "}
                                          </span>
                                        ) : null}
                                        {v.refundedUsd > 0 ? (
                                          <span>refunded {money(v.refundedUsd)} </span>
                                        ) : null}
                                        {v.computeNowUsd !== v.computeUsd ? (
                                          <span style={{ color: "var(--hq-red, #b42318)" }}>
                                            compute now {money(v.computeNowUsd)} (billed{" "}
                                            {money(v.computeUsd)})
                                          </span>
                                        ) : null}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
