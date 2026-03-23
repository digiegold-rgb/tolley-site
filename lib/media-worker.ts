const WORKER_URL =
  process.env.MEDIA_WORKER_URL || "https://media.tolley.io";
const WORKER_SECRET =
  process.env.MEDIA_WORKER_SECRET || "tolley-media-2026";

async function workerFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      "x-media-secret": WORKER_SECRET,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Worker responded ${res.status}`);
  }
  return res.json();
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
