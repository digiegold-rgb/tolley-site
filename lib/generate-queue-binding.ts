/**
 * Bind /generate parent queues (Motion 2 + Cinema) to an explicit job id.
 *
 * latestLongformJob(createdBy) alone is wrong across actors: HQ PIN is
 * `hq:<role>`, shop PIN is `shop-admin`. Restore by id (URL / localStorage)
 * first. When there is no id, latest among the operator aliases — never a
 * silent swap to another person's test queue.
 */

export const LONGFORM_QUEUE_STORAGE_KEY = "tolley.generate.longform.queueId";
export const CINEMA_QUEUE_STORAGE_KEY = "tolley.generate.cinema.queueId";
export const LONGFORM_QUEUE_PARAM = "queue";
export const CINEMA_QUEUE_PARAM = "cinema";

export const GENERATE_OPERATOR_ACTORS = ["shop-admin", "hq"] as const;

export const SPEND_CONFIRM_USD = 5;
export const QUEUE_STUCK_MS = 11 * 60 * 1000;

export function generateActorAliases(createdBy: string): string[] {
  const actor = (createdBy || "").trim();
  const aliases = new Set<string>();
  if (actor) aliases.add(actor);
  if (actor === "shop-admin" || actor === "hq" || actor.startsWith("hq:")) {
    aliases.add("shop-admin");
    aliases.add("hq");
    aliases.add(actor);
  }
  return [...aliases];
}

export function isSharedGenerateOperator(createdBy: string): boolean {
  const actor = (createdBy || "").trim();
  return actor === "shop-admin" || actor === "hq" || actor.startsWith("hq:");
}

export function latestQueueActorFilter(createdBy: string): { in: string[] } | string {
  const aliases = generateActorAliases(createdBy);
  if (isSharedGenerateOperator(createdBy) && aliases.length > 1) {
    return { in: aliases };
  }
  return createdBy;
}

export function readBoundQueueId(opts: {
  search?: string;
  storage?: Pick<Storage, "getItem"> | null;
  storageKey: string;
  param: string;
}): string {
  const params = new URLSearchParams((opts.search || "").replace(/^\?/, ""));
  const fromUrl =
    params.get(opts.param)?.trim() ||
    params.get("id")?.trim() ||
    params.get("queue_id")?.trim() ||
    "";
  if (fromUrl) return fromUrl;
  try {
    return (opts.storage?.getItem(opts.storageKey) || "").trim();
  } catch {
    return "";
  }
}

export function persistBoundQueueId(opts: {
  id: string;
  storage?: Pick<Storage, "setItem" | "removeItem"> | null;
  storageKey: string;
  history?: Pick<History, "replaceState"> | null;
  search?: string;
  pathname?: string;
  param: string;
}): string {
  const id = (opts.id || "").trim();
  try {
    if (opts.storage) {
      if (id) opts.storage.setItem(opts.storageKey, id);
      else opts.storage.removeItem(opts.storageKey);
    }
  } catch {
    /* private mode */
  }
  if (opts.history && typeof opts.pathname === "string") {
    const params = new URLSearchParams((opts.search || "").replace(/^\?/, ""));
    if (id) params.set(opts.param, id);
    else params.delete(opts.param);
    const q = params.toString();
    opts.history.replaceState(null, "", q ? `${opts.pathname}?${q}` : opts.pathname);
  }
  return id;
}

export function queueGetUrl(path: string, id: string | null | undefined): string {
  const trimmed = (id || "").trim();
  if (!trimmed) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}id=${encodeURIComponent(trimmed)}`;
}

export function needsSpendConfirm(usd: number, threshold = SPEND_CONFIRM_USD): boolean {
  return Number.isFinite(usd) && usd > threshold;
}

export function spendConfirmMessage(opts: {
  usd: number;
  beats: number;
  seconds: number;
  rateLabel: string;
}): string {
  return (
    `About $${opts.usd.toFixed(2)} for ${opts.beats} remaining beat(s) ` +
    `(${opts.seconds}s × ${opts.rateLabel}). Continue?`
  );
}

export function childStartedAtMs(child: {
  startedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}): number | null {
  const raw = child.startedAt || child.createdAt || child.updatedAt;
  if (!raw) return null;
  const ms = raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : null;
}

export function isStuckInFlightChild(
  child: {
    status: string;
    startedAt?: Date | string | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
  },
  now = Date.now(),
  limitMs = QUEUE_STUCK_MS,
): boolean {
  const status = (child.status || "").trim();
  if (status !== "running" && status !== "queued" && status !== "generating") return false;
  const started = childStartedAtMs(child);
  if (started == null) return false;
  return now - started >= limitMs;
}

export function formatStuckQueueError(detail?: string): string {
  const extra = (detail || "").trim();
  return (
    "Queue stuck — no fal progress past ~11 min (or fal finished while the parent stayed generating). " +
    "Generate is unlocked. Retry, Dismiss, or Continue queue." +
    (extra ? ` ${extra}` : "")
  ).slice(0, 500);
}
