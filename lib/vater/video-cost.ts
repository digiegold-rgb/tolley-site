// Per-video real generation cost (YouTubeProject.costJson), pushed by the
// DGX on job completion. Real cash only — Claude tokens are tracked
// separately at $0 by convention (Jared 2026-08-06).

export interface VideoCostStage {
  usd: number;
  calls?: number;
  estimated?: boolean;
  detail?: string;
}

export interface VideoCostJson {
  totalUsd?: number;
  modalUsd?: number;
  geminiUsd?: number;
  falUsd?: number;
  otherUsd?: number;
  llmUsd?: number;
  estimated?: boolean;
  byStage?: Record<string, VideoCostStage>;
  updatedAt?: string;
}

export function parseVideoCost(raw: unknown): VideoCostJson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as VideoCostJson;
  const total =
    typeof c.totalUsd === "number"
      ? c.totalUsd
      : (c.modalUsd ?? 0) + (c.geminiUsd ?? 0) + (c.falUsd ?? 0) + (c.otherUsd ?? 0);
  if (!Number.isFinite(total)) return null;
  return { ...c, totalUsd: total };
}

export function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

/** Non-zero provider rows for breakdown UIs, largest first. */
export function costProviderRows(c: VideoCostJson): { label: string; usd: number }[] {
  const rows: { label: string; usd: number }[] = [
    { label: "Modal GPU", usd: c.modalUsd ?? 0 },
    { label: "Gemini", usd: c.geminiUsd ?? 0 },
    { label: "fal.ai", usd: c.falUsd ?? 0 },
    { label: "Other (LLM etc.)", usd: c.otherUsd ?? 0 },
  ].filter((r) => r.usd > 0);
  return rows.sort((a, b) => b.usd - a.usd);
}
