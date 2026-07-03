"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditChat } from "./CreditChat";
import { ScoreCards } from "./ScoreCards";
import { UtilizationGauge } from "./UtilizationGauge";
import { CardTable } from "./CardTable";
import { GoalsTimeline } from "./GoalsTimeline";
import { RecommendationsPanel } from "./RecommendationsPanel";
import { PaymentCalendar } from "./PaymentCalendar";
import { ScoreHistoryChart } from "./ScoreHistoryChart";
import { ScoreProjection } from "./ScoreProjection";
import { DebtTracker } from "./DebtTracker";
import { ManualScoreEntry } from "./ManualScoreEntry";
import { RoadmapTimeline } from "./RoadmapTimeline";
import { LegalDashboard } from "./LegalDashboard";
import { HelocReadiness } from "./HelocReadiness";
import { BusinessVentures } from "./BusinessVentures";

type DashboardData = {
  helocReadiness?: any;
  ventures?: any[];
  incomeSummary?: any;
  scores: {
    latest: any;
    previous: any;
    perBureau: any;
    bestScore: number | null;
    avgScore: number | null;
    startScore: number | null;
    startDate: string | null;
    trend: { transunion: number; equifax: number } | null;
    historyCount: number;
  };
  utilization: {
    overall: {
      balance: number;
      limit: number;
      utilization_pct: number;
      band: string;
    };
    perCard: any[];
  };
  cards: any[];
  cardTotals: any;
  goals: any[];
  upcomingEvents: any[];
  courtCases: any[];
  recommendations: any[];
  debts: any[];
  debtTotals: any;
  scoreProjection: any[];
  tactics: any[];
  disputes: any[];
  violations: any[];
  lastSync: string | null;
};

export function CreditDashboard({
  initialData,
}: {
  initialData: DashboardData | null;
}) {
  const [data, setData] = useState<DashboardData | null>(initialData);
  const [activeTab, setActiveTab] = useState<
    "overview" | "debts" | "legal" | "cards" | "history" | "plan"
  >("overview");
  const [showScoreEntry, setShowScoreEntry] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    triggeredAt: string;
    results: { source: string; ok: boolean; detail?: string; durationMs: number }[];
  } | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [logBody, setLogBody] = useState<{
    name: string;
    exists: boolean;
    mtime?: string;
    tail?: string;
  } | null>(null);

  const SOURCE_TO_LOG: Record<string, string> = {
    scores: "sync-all-scores",
    court_cases: "casenet",
  };

  const loadLog = useCallback(async (source: string) => {
    const logName = SOURCE_TO_LOG[source];
    if (!logName) return;
    setOpenLog(source);
    setLogBody(null);
    try {
      const res = await fetch(`/api/credit/scraper-log/${logName}`);
      if (res.ok) setLogBody(await res.json());
    } catch {
      setLogBody({ name: logName, exists: false });
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/credit");
      if (res.ok) setData(await res.json());
    } catch {}
  }, []);

  const refreshAll = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/credit/refresh-all", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (body?.results) {
        setSyncResult({ triggeredAt: body.triggeredAt, results: body.results });
      }
    } catch (err: any) {
      setSyncResult({
        triggeredAt: new Date().toISOString(),
        results: [
          { source: "request", ok: false, detail: err?.message || "failed", durationMs: 0 },
        ],
      });
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [refresh]);

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "debts" as const, label: "Debts & Settlements" },
    { id: "legal" as const, label: "Legal & Disputes" },
    { id: "cards" as const, label: "Cards" },
    { id: "history" as const, label: "Score History" },
    { id: "plan" as const, label: "Goals & Plan" },
  ];

  const avgScore = data?.scores?.latest
    ? Math.round(
        ((data.scores.latest.transunion || 0) +
          (data.scores.latest.equifax || 0) +
          (data.scores.latest.experian || 0)) /
          [
            data.scores.latest.transunion,
            data.scores.latest.equifax,
            data.scores.latest.experian,
          ].filter(Boolean).length
      )
    : null;

  return (
    <div className="space-y-5">
      {/* AI Chat — top of page */}
      <CreditChat />

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "border border-[#00d4ff]/40 bg-[#00d4ff]/15 text-white"
                : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={refreshAll}
          disabled={syncing}
          className="ml-auto rounded-xl border border-[#00d4ff]/40 bg-[#00d4ff]/15 px-4 py-2 text-sm font-medium text-white hover:bg-[#00d4ff]/25 disabled:cursor-not-allowed disabled:opacity-50"
          title="Trigger Plaid + score scrapers + court scan + AI recommendations"
        >
          {syncing ? "Refreshing…" : "↻ Refresh All"}
        </button>
        <button
          onClick={() => setShowScoreEntry(!showScoreEntry)}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white/80"
        >
          + Add Score
        </button>
      </div>

      {syncResult && (
        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold tracking-wider text-[#00d4ff] uppercase">
              Sync Status
            </span>
            <span className="text-xs text-white/40">
              {new Date(syncResult.triggeredAt).toLocaleString("en-US", {
                timeZone: "America/Chicago",
              })}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {syncResult.results.map((r) => {
              const hasLog = !!SOURCE_TO_LOG[r.source];
              return (
                <div
                  key={r.source}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span className={r.ok ? "text-green-400" : "text-red-400"}>
                      ●
                    </span>
                    <span className="text-white/80">{r.source}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-white/40">
                      {r.detail ? r.detail : r.ok ? "ok" : "failed"}
                      {" · "}
                      {Math.round(r.durationMs)}ms
                    </span>
                    {hasLog && (
                      <button
                        onClick={() => loadLog(r.source)}
                        className="text-xs text-[#00d4ff] hover:underline"
                      >
                        log
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-white/30">
            Score scrapes + court scan run in the background on the ledger — give
            them 1–5 minutes, then this dashboard auto-refreshes.
          </p>

          {openLog && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-white/60">
                  Log: {SOURCE_TO_LOG[openLog]}
                  {logBody?.mtime && (
                    <span className="ml-2 text-white/30">
                      ({new Date(logBody.mtime).toLocaleTimeString("en-US", {
                        timeZone: "America/Chicago",
                      })})
                    </span>
                  )}
                </span>
                <span className="flex gap-3 text-xs">
                  <button
                    onClick={() => loadLog(openLog)}
                    className="text-[#00d4ff] hover:underline"
                  >
                    refresh
                  </button>
                  <button
                    onClick={() => {
                      setOpenLog(null);
                      setLogBody(null);
                    }}
                    className="text-white/50 hover:text-white"
                  >
                    close
                  </button>
                </span>
              </div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-snug text-white/70">
                {logBody === null
                  ? "loading…"
                  : logBody.exists
                    ? logBody.tail || "(empty)"
                    : "(no log yet — scraper hasn't run since last restart)"}
              </pre>
            </div>
          )}
        </div>
      )}

      {showScoreEntry && (
        <ManualScoreEntry
          onSaved={() => {
            setShowScoreEntry(false);
            refresh();
          }}
        />
      )}

      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Income & Ventures — the real lever, leads the page */}
          <BusinessVentures ventures={data?.ventures} onSaved={refresh} />

          {/* HELOC readiness — the #1 goal, three gates */}
          <HelocReadiness
            readiness={data?.helocReadiness}
            onSaved={refresh}
          />

          {/* Score cards */}
          <ScoreCards
            perBureau={data?.scores?.perBureau ?? null}
            bestScore={data?.scores?.bestScore ?? null}
            avgScore={data?.scores?.avgScore ?? null}
            startScore={data?.scores?.startScore ?? null}
            goal={680}
          />

          {/* Score Projection Slider */}
          <ScoreProjection
            projection={data?.scoreProjection}
            currentScore={data?.scores?.bestScore ?? avgScore ?? undefined}
          />

          {/* Debt Tracker */}
          <DebtTracker debts={data?.debts} totals={data?.debtTotals} />

          {/* 5-Month Roadmap */}
          <RoadmapTimeline />

          {/* Utilization + Payment Calendar */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <UtilizationGauge
              overall={data?.utilization?.overall}
              perCard={data?.utilization?.perCard}
            />
            <PaymentCalendar events={data?.upcomingEvents} />
          </div>

          {/* Recommendations */}
          <RecommendationsPanel recommendations={data?.recommendations} />
        </div>
      )}

      {activeTab === "debts" && (
        <div className="space-y-5">
          <DebtTracker debts={data?.debts} totals={data?.debtTotals} />
          <RoadmapTimeline />
          <GoalsTimeline goals={data?.goals} />
        </div>
      )}

      {activeTab === "legal" && (
        <LegalDashboard
          courtCases={data?.courtCases}
          tactics={data?.tactics}
          disputes={data?.disputes}
          violations={data?.violations}
          debts={data?.debts}
          onRefresh={refresh}
        />
      )}

      {activeTab === "cards" && (
        <CardTable cards={data?.cards} totals={data?.cardTotals} />
      )}

      {activeTab === "history" && <ScoreHistoryChart />}

      {activeTab === "plan" && (
        <div className="space-y-5">
          <HelocReadiness readiness={data?.helocReadiness} onSaved={refresh} />
          <GoalsTimeline goals={data?.goals} />
        </div>
      )}

      {/* Non-negotiable rules */}
      <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
        <h4 className="mb-3 text-sm font-bold tracking-wider text-[#00d4ff] uppercase">
          The Non-Negotiable Rules
        </h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            {
              rule: "ALWAYS get settlement in writing BEFORE paying",
              color: "text-orange-400",
            },
            {
              rule: "NEVER pay by check — cashier's check only",
              color: "text-red-400",
            },
            {
              rule: "Ask for PAY-FOR-DELETE on every account",
              color: "text-yellow-400",
            },
            {
              rule: "Do NOT pay charge-offs without a deal — restarts SOL",
              color: "text-orange-400",
            },
            {
              rule: "Keep paying Zwicker $200/mo UNLESS lump-sum deal",
              color: "text-purple-400",
            },
            {
              rule: "Log every call: date, rep name, reference #",
              color: "text-yellow-400",
            },
            {
              rule: "Keep Cap One 0369, Kikoff, Barclays under 10%",
              color: "text-green-400",
            },
            {
              rule: "Truck stays — income tool, not negotiable",
              color: "text-cyan-400",
            },
          ].map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 ${r.color}`}>&#9679;</span>
              <span className="text-white/65">{r.rule}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sync info */}
      {data?.lastSync && (
        <p className="text-center text-xs text-white/30">
          Last synced:{" "}
          {new Date(data.lastSync).toLocaleString("en-US", {
            timeZone: "America/Chicago",
          })}
        </p>
      )}
    </div>
  );
}
