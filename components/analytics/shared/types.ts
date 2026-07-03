// Shared types for the Tolley analytics command center.

export interface AlertChip {
  id: string;
  severity: "red" | "amber";
  title: string;
  detail?: string;
  href?: string;
  category: "auth" | "quota" | "cron" | "billing" | "queue" | "sync";
}

export interface AlertsResponse {
  generatedAt: string;
  alerts: AlertChip[];
}

export interface PulseResponse {
  generatedAt: string;
  kpis: {
    revenueTodayCents: number;
    revenueYesterdayCents: number;
    newSubsToday: number;
    leads24h: number;
    sessionsToday: number;
    cronOk24h: number;
    cronTotal24h: number;
    cashBalanceCents: number;
  };
  moneyDaily14d: { date: string; total: number; byBusiness: Record<string, number> }[];
  cronStatus: {
    path: string;
    schedule: string;
    expectedRunsToday: number;
    actualRunsToday: number;
    lastRun: string | null;
    healthy: boolean;
  }[];
  pipeline: {
    label: string;
    today: number;
    week: number;
  }[];
  topSitesToday: {
    site: string;
    label: string;
    sessions: number;
    weekAgo: number;
  }[];
  errors: string[];
}

export interface CronRow {
  path: string;
  schedule: string;
  lastRun: string | null;
  expectedRuns24h: number;
  actualRuns24h: number;
  ageMinutes: number | null;
  healthy: boolean;
}

export interface IntegrationRow {
  name: string;
  status: "ok" | "warn" | "fail" | "unknown";
  detail: string;
  lastChecked: string | null;
}

export interface SystemsResponse {
  generatedAt: string;
  crons: CronRow[];
  integrations: IntegrationRow[];
  queues: {
    dossierJobsPending: number;
    dossierJobsRunning: number;
    dossierJobsStale: number;
    dossierMedianLatencyMs: number | null;
    socialJobsQueued: number;
    socialJobsFailed7d: number;
    smsEnrollmentsActive: number;
    reviewRequestsQueued: number;
  };
  serpapi: {
    today: number;
    monthlyCap: number;
    monthlyUsed: number;
    last7Days: { date: string; count: number }[];
  };
  errors: string[];
}
