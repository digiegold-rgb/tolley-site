/**
 * scripts/vater-bill-audit.ts — READ-ONLY sanity check on what each tenant
 * is being billed per video. Never adjusts anything (hard-money rule: no
 * money movement unless Jared names the action + amount) — it only flags.
 *
 * Per ready+final project: billed = billableComputeUsdForProject (EL and
 * Fable 5 repair passes stripped — billable.ts) + audioMinutes × ops rate.
 * Anomalies:
 *   • over_quote  — billed > 1.5 × the Fable 5 quote at submit (concierge only)
 *   • compute_spike — compute/min > 2 × the tenant's median compute/min
 *   • no_cost_card — ready+final but costJson has no total (unbilled work)
 *
 * Only videos delivered in the last `--days` (default 14) are FLAGGED; the
 * tenant median is taken over the last 30 days of deliveries (all-time when
 * fewer than 3) so early-pipeline renders and true-ups don't skew it.
 *
 * Usage: npx tsx scripts/vater-bill-audit.ts [--tenant <email>] [--json] [--days N] [--all]
 * Exit 0 always. Last stdout line is a one-line Telegram-ready summary.
 */
import { prisma } from "../lib/prisma";
import { billableComputeUsdForProject } from "../lib/vater/billing/billable";
import { getOpsRate } from "../lib/vater/billing/ops-fee";
import { readConcierge } from "../lib/vater/concierge";

const args = process.argv.slice(2);
const flag = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const asJson = args.includes("--json");
const tenantFilter = flag("--tenant") ?? null;
const flagDays = args.includes("--all") ? 0 : Number(flag("--days") ?? 14) || 14;
const MEDIAN_WINDOW_DAYS = 30;

const OVER_QUOTE_MULT = 1.5;
const SPIKE_MULT = 2;
const r2 = (n: number) => Math.round(n * 100) / 100;

interface Row {
  tenant: string;
  id: string;
  title: string;
  minutes: number;
  computeUsd: number;
  opsUsd: number;
  billedUsd: number;
  quoteUsd: number | null;
  computePerMin: number | null;
  engine: string;
  completedAt: string | null;
}
interface Anomaly {
  kind: "over_quote" | "compute_spike" | "no_cost_card";
  row: Row;
  detail: string;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function main() {
  const opsRate = getOpsRate();
  const flagSince = flagDays > 0 ? Date.now() - flagDays * 86_400_000 : 0;
  const medianSince = Date.now() - MEDIAN_WINDOW_DAYS * 86_400_000;
  const projects = await prisma.youTubeProject.findMany({
    where: {
      status: "ready",
      finalVideoUrl: { not: null },
      userId: { not: null },
    },
    select: {
      id: true,
      userId: true,
      sourceTitle: true,
      publishTitle: true,
      audioDuration: true,
      costJson: true,
      settingsJson: true,
      completedAt: true,
      updatedAt: true,
    },
  });
  const userIds = [...new Set(projects.map((p) => p.userId!).filter(Boolean))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } });
  const emailOf = new Map(users.map((u) => [u.id, u.email ?? u.id]));

  const rows: Row[] = [];
  for (const p of projects) {
    const tenant = emailOf.get(p.userId!) ?? p.userId!;
    if (tenantFilter && tenant !== tenantFilter) continue;
    const minutes = Math.max(0, Number(p.audioDuration ?? 0)) / 60;
    const computeUsd = r2(billableComputeUsdForProject(p));
    const opsUsd = r2(minutes * opsRate);
    const ticket = readConcierge(p.settingsJson);
    const engine =
      p.settingsJson && typeof p.settingsJson === "object" && (p.settingsJson as { engine?: unknown }).engine === "fable5"
        ? "fable5"
        : "auto";
    rows.push({
      tenant,
      id: p.id,
      title: (p.publishTitle ?? p.sourceTitle ?? p.id).slice(0, 70),
      minutes: r2(minutes),
      computeUsd,
      opsUsd,
      billedUsd: r2(computeUsd + opsUsd),
      quoteUsd: ticket?.estimateUsd ? r2(ticket.estimateUsd) : null,
      computePerMin: minutes > 0.25 ? r2(computeUsd / minutes) : null,
      engine,
      completedAt: (p.completedAt ?? p.updatedAt).toISOString(),
    });
  }

  const anomalies: Anomaly[] = [];
  const byTenant = new Map<string, Row[]>();
  for (const r of rows) byTenant.set(r.tenant, [...(byTenant.get(r.tenant) ?? []), r]);
  const medians = new Map<string, number | null>();
  for (const [tenant, trs] of byTenant) {
    const perMin = (rs: Row[]) => rs.map((r) => r.computePerMin).filter((v): v is number => v !== null && v > 0);
    const recentRows = trs.filter((r) => new Date(r.completedAt).getTime() >= medianSince);
    const med = median(perMin(recentRows).length >= 3 ? perMin(recentRows) : perMin(trs));
    medians.set(tenant, med);
    for (const r of trs) {
      if (new Date(r.completedAt).getTime() < flagSince) continue;
      const total = Number((projects.find((p) => p.id === r.id)?.costJson as { totalUsd?: number } | null)?.totalUsd ?? 0);
      if (!total) {
        anomalies.push({ kind: "no_cost_card", row: r, detail: "ready + final but costJson.totalUsd is empty — unbilled work" });
        continue;
      }
      if (r.quoteUsd && r.billedUsd > OVER_QUOTE_MULT * r.quoteUsd) {
        anomalies.push({
          kind: "over_quote",
          row: r,
          detail: `billed $${r.billedUsd} > ${OVER_QUOTE_MULT}× quote $${r.quoteUsd}`,
        });
      }
      if (med && r.minutes >= 1 && r.computePerMin !== null && r.computePerMin > SPIKE_MULT * med) {
        anomalies.push({
          kind: "compute_spike",
          row: r,
          detail: `compute $${r.computePerMin}/min > ${SPIKE_MULT}× tenant median $${r2(med)}/min`,
        });
      }
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), opsRate, rows, medians: Object.fromEntries(medians), anomalies }, null, 1));
    return;
  }
  console.log(
    `vater-bill-audit · ${rows.length} delivered videos · ${byTenant.size} tenants · ops $${opsRate}/min · flagging ${flagDays > 0 ? `last ${flagDays} days` : "all time"}`,
  );
  for (const [tenant, trs] of byTenant) {
    const med = medians.get(tenant);
    console.log(`\n${tenant} · ${trs.length} videos · median compute $${med != null ? r2(med) : "—"}/min`);
    for (const r of trs.sort((a, b) => a.completedAt.localeCompare(b.completedAt))) {
      const q = r.quoteUsd ? ` quote $${r.quoteUsd}` : "";
      console.log(
        `  ${r.title.padEnd(72)} ${String(r.minutes).padStart(5)} min  compute $${String(r.computeUsd).padStart(6)}  ops $${String(r.opsUsd).padStart(6)}  billed $${String(r.billedUsd).padStart(6)}${q} [${r.engine}]`,
      );
    }
  }
  console.log("");
  if (!anomalies.length) {
    console.log("✅ bill audit: 0 anomalies");
  } else {
    for (const a of anomalies) console.log(`⚠️ ${a.kind} · ${a.row.tenant} · ${a.row.title} · ${a.detail}`);
    console.log("");
    const line = anomalies
      .slice(0, 6)
      .map((a) => `${a.kind}: ${a.row.title.slice(0, 40)} (${a.detail})`)
      .join(" | ");
    console.log(`⚠️ bill audit: ${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"} — ${line}${anomalies.length > 6 ? " …" : ""}`);
  }
}

main()
  .catch((e) => {
    console.error("bill audit failed:", e instanceof Error ? e.message : e);
  })
  .finally(() => prisma.$disconnect());
