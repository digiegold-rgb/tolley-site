import "server-only";

const WORKER_URL = process.env.MEDIA_WORKER_URL || "https://media.tolley.io";

export class MediaWorkerError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "MediaWorkerError";
    this.status = status;
  }
}

export type MediaRoute = "download" | "queue" | "recent" | "search";

function requireWorkerSecret(): string {
  const secret = process.env.MEDIA_WORKER_SECRET?.trim();
  if (!secret) {
    throw new MediaWorkerError("MEDIA_WORKER_SECRET is not set", null);
  }
  return secret;
}

function scrub(message: string, secret: string): string {
  return message.split(secret).join("[redacted]");
}

function clamp(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Media worker request failed";
  if (trimmed.length <= 500) return trimmed;
  return `${trimmed.slice(0, 500)}…`;
}

function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Media worker request failed";
  const cause =
    err.cause instanceof Error
      ? err.cause.message
      : typeof err.cause === "string"
        ? err.cause
        : "";
  if (cause && !err.message.includes(cause)) {
    return `${err.message}: ${cause}`;
  }
  return err.message || "Media worker request failed";
}

function workerErrorText(body: unknown, status: number): string {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  return `Worker responded ${status}`;
}

async function workerFetch(path: string, init?: RequestInit) {
  const secret = requireWorkerSecret();
  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}${path}`, {
      ...init,
      headers: {
        "x-media-secret": secret,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (err) {
    throw new MediaWorkerError(clamp(scrub(errorMessage(err), secret)), null);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new MediaWorkerError(
      clamp(scrub(workerErrorText(body, res.status), secret)),
      res.status,
    );
  }
  return res.json();
}

/** Log a worker failure for Vercel runtime logs. Never includes the secret. */
export function logMediaWorkerFailure(
  route: MediaRoute,
  err: unknown,
): { error: string; status: number | null } {
  const secret = process.env.MEDIA_WORKER_SECRET?.trim();
  const status = err instanceof MediaWorkerError ? err.status : null;
  const raw =
    err instanceof Error && err.message
      ? err.message
      : "Media worker request failed";
  const error = clamp(secret ? scrub(raw, secret) : raw);
  console.error(`[api/media/${route}] worker request failed`, {
    route,
    status,
    error,
  });
  return { error, status };
}

export type MediaCategory = "music" | "music-video" | "video";

export async function submitDownload(
  url: string,
  category: MediaCategory,
  title?: string,
) {
  return workerFetch("/download", {
    method: "POST",
    body: JSON.stringify({ url, category, title }),
  });
}

export async function getJobs() {
  return workerFetch("/jobs");
}

export async function getJob(id: string) {
  return workerFetch(`/jobs/${id}`);
}

export async function searchYouTube(query: string) {
  return workerFetch(`/search?q=${encodeURIComponent(query)}`);
}

export async function getRecent() {
  return workerFetch("/recent");
}

export async function getHealth() {
  return workerFetch("/health");
}
