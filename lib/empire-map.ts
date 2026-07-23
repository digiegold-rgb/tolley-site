// ── Empire Map payload builder — merges the static catalog with live health ──
// Three signal families: the latest DGX snapshot (EmpireSnapshot row, pushed
// 2×/day by the empire-collector), site-side cron heartbeats (lib/cron-config),
// and small Prisma activity queries. Compute is cached 5 min under the
// "empire" tag; the sync route revalidates it so DGX pushes appear instantly.
// Auth stays in the route — never inside unstable_cache (no cookies there).

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CRONS } from "@/lib/cron-config";
import { EMPIRE_NODES, type EmpireStatus } from "@/lib/empire-catalog";

// Shape of the collector's POST body (version 1) — see collect.mjs.
interface DgxUnit {
  activeState?: string;
  subState?: string;
  result?: string;
  exitStatus?: number;
  lastRun?: string | null;
  nextRun?: string | null;
  nRestarts?: number;
}
interface DgxSnapshot {
  version: number;
  generatedAt: string;
  host?: string;
  units?: Record<string, DgxUnit>;
  ports?: Record<string, { port: number; ok: boolean; latencyMs: number | null }>;
  docker?: Record<string, string>;
  files?: Record<string, { path: string; mtime: string | null; ageMin: number | null; lastLine?: string }>;
  backup?: {
    lastComplete: string | null;
    ok: boolean;
    errors: number;
    offsite: { ok: boolean; lastError: string | null };
  };
  fleet?: Record<string, string>;
}

export interface EmpireMetric {
  label: string;
  value: string;
}
export interface EmpireNodeHealth {
  status: EmpireStatus;
  lastRun: string | null; // ISO
  ageMin: number | null;
  detail: string;
  metrics?: EmpireMetric[];
}
export interface EmpirePayload {
  generatedAt: string;
  dgxSnapshotAt: string | null;
  dgxStale: boolean; // snapshot older than 18h
  nodes: Record<string, EmpireNodeHealth>;
}

const DGX_STALE_MIN = 18 * 60;
const DGX_DEAD_MIN = 36 * 60;

function ageMinutes(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = typeof d === "string" ? Date.parse(d) : d.getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// working ≤1.5× cadence · stale ≤4× · broken beyond (or explicit failure).
function bucket(ageMin: number | null, cadenceMin: number | undefined, failed: boolean): EmpireStatus {
  if (failed) return "broken";
  if (ageMin == null) return "missing";
  if (!cadenceMin) return "working";
  if (ageMin <= cadenceMin * 1.5) return "working";
  if (ageMin <= cadenceMin * 4) return "stale";
  return "broken";
}

// ── Named DB activity signals ────────────────────────────────────────────────
// Each returns the newest relevant timestamp plus optional drawer metrics.
// Keep these cheap — they all run on every (cache-miss) payload build.
type DbSignalResult = { lastRun: Date | null; metrics?: EmpireMetric[] };

const since30d = () => new Date(Date.now() - 30 * 86400_000);

const DB_SIGNALS: Record<string, () => Promise<DbSignalResult>> = {
  estate: async () => {
    const [lead, sale, leads30] = await Promise.all([
      prisma.estateLead.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.estateSale.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true, status: true, title: true } }),
      prisma.estateLead.count({ where: { createdAt: { gte: since30d() } } }),
    ]);
    const last = [lead?.createdAt, sale?.updatedAt].filter(Boolean).sort().pop() ?? null;
    return {
      lastRun: (last as Date | null) ?? null,
      metrics: [
        { label: "Leads 30d", value: String(leads30) },
        ...(sale ? [{ label: "Latest sale", value: `${sale.title} (${sale.status})` }] : []),
      ],
    };
  },
  wd: async () => {
    const [msg, active] = await Promise.all([
      prisma.wdMessage.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.wdClient.count({ where: { active: true, subscriptionStatus: "active" } }).catch(() => -1),
    ]);
    return {
      lastRun: msg?.createdAt ?? null,
      metrics: active >= 0 ? [{ label: "Active subs", value: String(active) }] : [],
    };
  },
  tagent: async () => {
    const ev = await prisma.usageEvent.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    return { lastRun: ev?.createdAt ?? null };
  },
  passive: async () => {
    const [sub, activeCount] = await Promise.all([
      prisma.digestSubscriber.findFirst({ orderBy: { joinedAt: "desc" }, select: { joinedAt: true } }),
      prisma.digestSubscriber.count({ where: { status: { in: ["active", "trial"] } } }),
    ]);
    return { lastRun: sub?.joinedAt ?? null, metrics: [{ label: "Active subs", value: String(activeCount) }] };
  },
  youtube: async () => {
    const stat = await prisma.youTubeVideoStat.findFirst({ orderBy: { pulledAt: "desc" }, select: { pulledAt: true } });
    const videos = await prisma.youTubeVideo.count();
    return { lastRun: stat?.pulledAt ?? null, metrics: [{ label: "Videos tracked", value: String(videos) }] };
  },
  inbox: async () => {
    const [lead, action, new30] = await Promise.all([
      prisma.emailLead.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.leadAction.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.emailLead.count({ where: { createdAt: { gte: since30d() } } }),
    ]);
    const last = [lead?.createdAt, action?.createdAt].filter(Boolean).sort().pop() ?? null;
    return { lastRun: (last as Date | null) ?? null, metrics: [{ label: "Email leads 30d", value: String(new30) }] };
  },
  touches: async () => {
    const [sent, sent30] = await Promise.all([
      prisma.growthTouch.findFirst({ where: { status: "sent" }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
      prisma.growthTouch.count({ where: { status: "sent", sentAt: { gte: since30d() } } }),
    ]);
    return { lastRun: sent?.sentAt ?? null, metrics: [{ label: "Sent 30d", value: String(sent30) }] };
  },
  circle: async () => {
    const [view, visits30, leads30, byRef] = await Promise.all([
      prisma.siteView.findFirst({ where: { site: "circle" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      prisma.siteView.count({ where: { site: "circle", createdAt: { gte: since30d() } } }),
      prisma.emailLead.count({ where: { source: "circle", createdAt: { gte: since30d() } } }),
      prisma.siteView.groupBy({
        by: ["referrer"],
        where: { site: "circle", createdAt: { gte: since30d() }, referrer: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 3,
      }).catch(() => [] as { referrer: string | null; _count: { _all: number } }[]),
    ]);
    return {
      lastRun: view?.createdAt ?? null,
      metrics: [
        { label: "Visits 30d", value: String(visits30) },
        { label: "Leads 30d", value: String(leads30) },
        ...byRef.map((r) => ({ label: `ref ${r.referrer ?? "?"}`.slice(0, 28), value: String(r._count._all) })),
      ],
    };
  },
};

async function dbViewsSignal(site: string): Promise<DbSignalResult> {
  const where = site === "any" ? {} : { site };
  const [view, count30] = await Promise.all([
    prisma.siteView.findFirst({ where, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.siteView.count({ where: { ...where, createdAt: { gte: since30d() } } }),
  ]);
  return { lastRun: view?.createdAt ?? null, metrics: [{ label: "Visits 30d", value: String(count30) }] };
}

// ── The compute ──────────────────────────────────────────────────────────────

async function computeEmpire(): Promise<EmpirePayload> {
  const snapRow = await prisma.empireSnapshot
    .findFirst({ where: { source: "dgx" }, orderBy: { createdAt: "desc" } })
    .catch(() => null);
  const snap = (snapRow?.payload ?? null) as DgxSnapshot | null;
  const snapAge = ageMinutes(snap?.generatedAt ?? snapRow?.createdAt ?? null);
  const dgxStale = snapAge == null || snapAge > DGX_STALE_MIN;

  // Site-side cron heartbeats (only entries that define one can be aged).
  const cronHealth = new Map<string, { lastRun: Date | null; ageMin: number | null; cadenceMin: number; healthy: boolean; hasHeartbeat: boolean }>();
  await Promise.allSettled(
    CRONS.map(async (c) => {
      const lastRun = c.heartbeat ? await c.heartbeat().catch(() => null) : null;
      const age = ageMinutes(lastRun);
      cronHealth.set(c.path, {
        lastRun,
        ageMin: age,
        cadenceMin: c.cadenceMin,
        healthy: !c.heartbeat || (age != null && age <= c.cadenceMin * 1.5),
        hasHeartbeat: Boolean(c.heartbeat),
      });
    })
  );

  // DB signals, all at once, failures isolated.
  const dbResults = new Map<string, DbSignalResult>();
  const dbKeys = new Set<string>();
  for (const n of EMPIRE_NODES) {
    if (n.signal.startsWith("db:")) dbKeys.add(n.signal.slice(3));
  }
  await Promise.allSettled(
    [...dbKeys].map(async (key) => {
      const fn = key.startsWith("views:") ? () => dbViewsSignal(key.slice(6)) : DB_SIGNALS[key];
      if (!fn) return;
      dbResults.set(key, await fn());
    })
  );

  const nodes: Record<string, EmpireNodeHealth> = {};

  for (const def of EMPIRE_NODES) {
    const s = def.signal;
    let h: EmpireNodeHealth = { status: "missing", lastRun: null, ageMin: null, detail: "no signal" };

    try {
      if (s.startsWith("manual:")) {
        const rest = s.slice(7);
        if (rest === "paused") h = { status: "paused", lastRun: null, ageMin: null, detail: "deliberately paused" };
        else if (rest === "killed") h = { status: "killed", lastRun: null, ageMin: null, detail: "shut down on purpose" };
        else if (rest === "missing") h = { status: "missing", lastRun: null, ageMin: null, detail: "not built yet" };
        else if (rest.startsWith("broken:")) h = { status: "broken", lastRun: null, ageMin: null, detail: rest.slice(7) };
      } else if (s === "cron:rollup") {
        const rows = [...cronHealth.entries()].filter(([, v]) => v.hasHeartbeat);
        const bad = rows.filter(([, v]) => !v.healthy);
        const newest = rows.map(([, v]) => v.lastRun).filter(Boolean).sort().pop() ?? null;
        // Many heartbeats only tick when new data arrives, so a few "stale"
        // rows are normal background noise — red is reserved for a mass outage.
        h = {
          status: bad.length >= 8 ? "broken" : bad.length > 0 ? "stale" : "working",
          lastRun: iso(newest as Date | null),
          ageMin: ageMinutes(newest as Date | null),
          detail: bad.length ? `${bad.length}/${rows.length} tracked crons unhealthy` : `${rows.length} tracked crons healthy (${CRONS.length} total)`,
          metrics: bad.slice(0, 6).map(([path, v]) => ({ label: path.replace("/api/cron/", ""), value: v.ageMin != null ? `${Math.round(v.ageMin / 60)}h ago` : "never" })),
        };
      } else if (s.startsWith("cron:")) {
        const c = cronHealth.get(s.slice(5));
        if (!c) h = { status: "missing", lastRun: null, ageMin: null, detail: `unknown cron ${s.slice(5)}` };
        else if (!c.hasHeartbeat) h = { status: "working", lastRun: null, ageMin: null, detail: "scheduled on Vercel — no heartbeat, trusted" };
        else {
          // Catalog cadenceMin overrides the cron's own cadence — used when a
          // heartbeat only ticks on new data (e.g. RSS polls).
          const cadence = def.cadenceMin ?? c.cadenceMin;
          h = { status: bucket(c.ageMin, cadence, false), lastRun: iso(c.lastRun), ageMin: c.ageMin, detail: `cadence ${cadence}m` };
        }
      } else if (s.startsWith("db:")) {
        const r = dbResults.get(s.slice(3));
        const age = ageMinutes(r?.lastRun ?? null);
        h = {
          status: bucket(age, def.cadenceMin, false),
          lastRun: iso(r?.lastRun ?? null),
          ageMin: age,
          detail: r?.lastRun ? "latest DB activity" : "no activity recorded",
          metrics: r?.metrics,
        };
      } else if (s.startsWith("dgx:")) {
        h = resolveDgxSignal(s, def.cadenceMin, snap, snapAge);
        // A stale snapshot can't vouch for green — degrade, don't lie.
        if (dgxStale && (h.status === "working" || h.status === "running") && s !== "dgx:self") {
          h = { ...h, status: "stale", detail: `${h.detail} · DGX snapshot ${snapAge != null ? Math.round(snapAge / 60) + "h" : "?"} old` };
        }
      }
    } catch (err) {
      h = { status: "missing", lastRun: null, ageMin: null, detail: `signal error: ${err instanceof Error ? err.message : "unknown"}` };
    }

    nodes[def.id] = h;
  }

  return {
    generatedAt: new Date().toISOString(),
    dgxSnapshotAt: iso(snap?.generatedAt ?? snapRow?.createdAt ?? null),
    dgxStale,
    nodes,
  };
}

function resolveDgxSignal(
  signal: string,
  cadenceMin: number | undefined,
  snap: DgxSnapshot | null,
  snapAge: number | null
): EmpireNodeHealth {
  const none: EmpireNodeHealth = { status: "missing", lastRun: null, ageMin: null, detail: "no DGX snapshot yet" };
  if (signal === "dgx:self") {
    if (snapAge == null) return { ...none, status: "broken", detail: "collector has never pushed" };
    const status: EmpireStatus = snapAge > DGX_DEAD_MIN ? "broken" : snapAge > DGX_STALE_MIN ? "stale" : "working";
    return { status, lastRun: iso(snap?.generatedAt ?? null), ageMin: snapAge, detail: `snapshot from ${snap?.host ?? "dgx"}` };
  }
  if (!snap) return none;

  if (signal.startsWith("dgx:unit:") || signal.startsWith("dgx:timer:")) {
    const isTimer = signal.startsWith("dgx:timer:");
    const name = signal.slice(isTimer ? 10 : 9);
    const u = snap.units?.[name];
    if (!u) return { ...none, detail: `unit ${name} not in snapshot` };
    const age = ageMinutes(u.lastRun);
    const failed = u.result === "failed" || u.result === "timeout" || (u.exitStatus ?? 0) !== 0;
    const unscheduled = isTimer && !u.nextRun;
    const metrics: EmpireMetric[] = [
      { label: "Unit", value: name },
      { label: "Result", value: u.result ?? "?" },
      ...(u.nextRun ? [{ label: "Next run", value: new Date(u.nextRun).toLocaleString("en-US", { timeZone: "America/Chicago" }) }] : []),
      ...(u.nRestarts ? [{ label: "Restarts", value: String(u.nRestarts) }] : []),
    ];
    // Long-running services report ActiveState, not run results.
    if (u.activeState === "active" && u.subState === "running") {
      return { status: "running", lastRun: iso(u.lastRun), ageMin: age, detail: "service active", metrics };
    }
    return {
      status: unscheduled ? "broken" : bucket(age, cadenceMin, failed),
      lastRun: iso(u.lastRun),
      ageMin: age,
      detail: unscheduled ? "timer has NO next run scheduled" : failed ? `unit failed (${u.result}, exit ${u.exitStatus})` : `exit ${u.exitStatus ?? 0}`,
      metrics,
    };
  }
  if (signal.startsWith("dgx:port:")) {
    const p = snap.ports?.[signal.slice(9)];
    if (!p) return { ...none, detail: `port ${signal.slice(9)} not probed` };
    return p.ok
      ? { status: "running", lastRun: iso(snap.generatedAt), ageMin: snapAge, detail: `port ${p.port} up${p.latencyMs != null ? ` · ${p.latencyMs}ms` : ""}` }
      : { status: "broken", lastRun: null, ageMin: null, detail: `port ${p.port} not answering` };
  }
  if (signal.startsWith("dgx:docker:")) {
    const st = snap.docker?.[signal.slice(11)];
    if (!st) return { ...none, detail: "container not in snapshot" };
    return st === "running"
      ? { status: "running", lastRun: iso(snap.generatedAt), ageMin: snapAge, detail: "container running" }
      : { status: "broken", lastRun: null, ageMin: null, detail: `container ${st}` };
  }
  if (signal.startsWith("dgx:file:")) {
    const f = snap.files?.[signal.slice(9)];
    if (!f) return { ...none, detail: "state file not in snapshot" };
    return {
      status: bucket(f.ageMin, cadenceMin, false),
      lastRun: iso(f.mtime),
      ageMin: f.ageMin,
      detail: f.lastLine ? f.lastLine.slice(0, 120) : f.path,
    };
  }
  if (signal.startsWith("dgx:fleet:")) {
    const v = snap.fleet?.[signal.slice(10)];
    if (v == null || v === "") return { ...none, detail: "not reported by fleet-status" };
    const bad = /down|fail|error|000/i.test(v);
    return { status: bad ? "broken" : "running", lastRun: iso(snap.fleet?.ts ?? snap.generatedAt), ageMin: snapAge, detail: v };
  }
  if (signal === "dgx:backup" || signal === "dgx:backup-offsite") {
    const b = snap.backup;
    if (!b) return { ...none, detail: "backup log not parsed" };
    if (signal === "dgx:backup-offsite") {
      return b.offsite.ok
        ? { status: "working", lastRun: iso(b.lastComplete), ageMin: ageMinutes(b.lastComplete), detail: "offsite sync clean" }
        : { status: "broken", lastRun: iso(b.lastComplete), ageMin: ageMinutes(b.lastComplete), detail: b.offsite.lastError ?? "offsite sync failing" };
    }
    const age = ageMinutes(b.lastComplete);
    return {
      status: bucket(age, cadenceMin, !b.ok),
      lastRun: iso(b.lastComplete),
      ageMin: age,
      detail: b.ok ? "nightly backup completing" : `backup errors: ${b.errors}`,
    };
  }
  return { ...none, detail: `unknown signal ${signal}` };
}

export const getEmpirePayload = unstable_cache(computeEmpire, ["empire-map"], {
  revalidate: 300,
  tags: ["empire"],
});
