"use client";

import { useTabData } from "../shared/hooks";
import { Panel, StatCard } from "../shared/panel";
import type { SystemsResponse } from "../shared/types";

function relativeAge(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "just now";
  if (min < 60) return `${Math.round(min)}m ago`;
  if (min < 1440) return `${Math.round(min / 60)}h ago`;
  return `${Math.round(min / 1440)}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  ok: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  warn: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  fail: "text-red-300 bg-red-500/10 border-red-500/30",
  unknown: "text-white/40 bg-white/5 border-white/10",
};

export default function SystemsTab() {
  const { data, loading, error, refetch } = useTabData<SystemsResponse>("/api/analytics/systems", {
    autoRefreshMs: 2 * 60_000,
  });

  if (loading && !data) return <div className="text-center text-white/40 py-12">Loading systems…</div>;
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-sm text-red-400">Error: {error}</div>
        <button onClick={refetch} className="mt-3 text-xs text-white/60 underline">Retry</button>
      </div>
    );
  }
  if (!data) return null;

  const okCount = data.crons.filter((c) => c.healthy).length;
  const failCount = data.crons.length - okCount;
  const maxSerp = Math.max(...data.serpapi.last7Days.map((d) => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Crons OK / total"
          value={`${okCount}/${data.crons.length}`}
          color={failCount === 0 ? "green" : failCount <= 2 ? "amber" : "red"}
        />
        <StatCard
          label="SerpAPI today"
          value={`${data.serpapi.today}/33`}
          color={data.serpapi.today >= 27 ? "amber" : "default"}
        />
        <StatCard
          label="SerpAPI MTD"
          value={`${data.serpapi.monthlyUsed}/${data.serpapi.monthlyCap}`}
          color={data.serpapi.monthlyUsed >= data.serpapi.monthlyCap * 0.8 ? "amber" : "default"}
        />
        <StatCard
          label="Dossier queue"
          value={data.queues.dossierJobsPending + data.queues.dossierJobsRunning}
          hint={data.queues.dossierJobsStale > 0 ? `${data.queues.dossierJobsStale} stale` : undefined}
          color={data.queues.dossierJobsStale > 0 ? "amber" : "default"}
        />
        <StatCard
          label="Social queued"
          value={data.queues.socialJobsQueued}
          hint={data.queues.socialJobsFailed7d > 0 ? `${data.queues.socialJobsFailed7d} failed 7d` : undefined}
          color={data.queues.socialJobsFailed7d > 0 ? "amber" : "default"}
        />
        <StatCard label="SMS active" value={data.queues.smsEnrollmentsActive} color="purple" />
      </div>

      <Panel title="Integration health">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.integrations.map((i) => (
            <div
              key={i.name}
              className={`rounded-lg border px-4 py-3 text-xs ${STATUS_COLOR[i.status]}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{i.name}</span>
                <span className="uppercase tracking-wide text-[0.55rem] opacity-80">{i.status}</span>
              </div>
              <div className="mt-1 text-white/70">{i.detail}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="SerpAPI quota · last 7d" className="lg:col-span-1">
          <div className="h-32 flex items-end gap-1">
            {data.serpapi.last7Days.map((d) => (
              <div key={d.date} className="flex-1 group relative" title={`${d.date}: ${d.count}`}>
                <div
                  className={`w-full rounded-t ${d.count >= 33 ? "bg-red-500" : d.count >= 27 ? "bg-amber-500" : "bg-purple-500"}`}
                  style={{ height: `${(d.count / Math.max(maxSerp, 33)) * 100}%`, minHeight: d.count > 0 ? "2px" : "0" }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 text-[0.6rem] text-white/40 flex justify-between">
            <span>{data.serpapi.last7Days[0]?.date}</span>
            <span>cap 33/day</span>
          </div>
        </Panel>

        <Panel title="Queue depths" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-white/40">Dossier pending</div>
              <div className="text-xl font-bold">{data.queues.dossierJobsPending}</div>
            </div>
            <div>
              <div className="text-white/40">Dossier running</div>
              <div className="text-xl font-bold">{data.queues.dossierJobsRunning}</div>
            </div>
            <div>
              <div className="text-white/40">Dossier stale (&gt;30m)</div>
              <div className={`text-xl font-bold ${data.queues.dossierJobsStale > 0 ? "text-amber-400" : ""}`}>
                {data.queues.dossierJobsStale}
              </div>
            </div>
            <div>
              <div className="text-white/40">Median latency</div>
              <div className="text-xl font-bold">
                {data.queues.dossierMedianLatencyMs ? `${Math.round(data.queues.dossierMedianLatencyMs / 1000)}s` : "—"}
              </div>
            </div>
            <div>
              <div className="text-white/40">Social queued</div>
              <div className="text-xl font-bold">{data.queues.socialJobsQueued}</div>
            </div>
            <div>
              <div className="text-white/40">Social failed (7d)</div>
              <div className={`text-xl font-bold ${data.queues.socialJobsFailed7d > 0 ? "text-amber-400" : ""}`}>
                {data.queues.socialJobsFailed7d}
              </div>
            </div>
            <div>
              <div className="text-white/40">SMS enrollments</div>
              <div className="text-xl font-bold">{data.queues.smsEnrollmentsActive}</div>
            </div>
            <div>
              <div className="text-white/40">Review requests queued</div>
              <div className="text-xl font-bold">{data.queues.reviewRequestsQueued}</div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title={`All crons (${data.crons.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-white/10 text-white/40 uppercase tracking-wide">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Path</th>
                <th className="py-2 pr-3">Schedule</th>
                <th className="py-2 pr-3 text-right">Last run</th>
              </tr>
            </thead>
            <tbody>
              {data.crons.map((c) => (
                <tr key={c.path} className="border-b border-white/5">
                  <td className="py-2 pr-3">
                    <span className={`inline-block h-2 w-2 rounded-full ${c.healthy ? "bg-emerald-400" : "bg-red-500"}`} />
                  </td>
                  <td className="py-2 pr-3 text-white/70 font-mono">{c.path.replace("/api/cron/", "")}</td>
                  <td className="py-2 pr-3 text-white/40 font-mono tabular-nums">{c.schedule}</td>
                  <td className="py-2 pr-3 text-right text-white/50 tabular-nums">{relativeAge(c.ageMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[0.6rem] text-white/30">
          ● Crons without explicit heartbeat detection are shown green by default — only crons that write to a
          tracked Prisma model are live-checked.
        </div>
      </Panel>

      {data.errors.length > 0 && (
        <details className="text-[0.65rem] text-amber-400/70">
          <summary>{data.errors.length} sub-query error{data.errors.length === 1 ? "" : "s"}</summary>
          <ul className="mt-2 space-y-0.5 list-disc list-inside">
            {data.errors.map((e, i) => (
              <li key={i} className="font-mono">{e}</li>
            ))}
          </ul>
        </details>
      )}
      <div className="text-[0.55rem] text-white/30 text-right">
        Generated {new Date(data.generatedAt).toLocaleTimeString()} · auto-refresh 2m
      </div>
    </div>
  );
}
