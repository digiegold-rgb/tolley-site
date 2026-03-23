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

type DashboardData = {
  scores: {
    latest: any;
    previous: any;
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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/credit");
      if (res.ok) setData(await res.json());
    } catch {}
  }, []);

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
          onClick={() => setShowScoreEntry(!showScoreEntry)}
          className="ml-auto rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white/80"
        >
          + Add Score
        </button>
      </div>

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
          {/* Score cards */}
          <ScoreCards
            latest={data?.scores?.latest ?? null}
            trend={data?.scores?.trend ?? null}
          />

          {/* Score Projection Slider */}
          <ScoreProjection
            projection={data?.scoreProjection}
            currentScore={avgScore ?? undefined}
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

      {activeTab === "plan" && <GoalsTimeline goals={data?.goals} />}

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
