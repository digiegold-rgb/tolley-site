/**
 * Durable refs for /generate Modal stills.
 *
 * Job outputs are Spark-first (`spark:…`). Private Vercel Blob is a fallback
 * only (`blob:…`). Public `*.public.blob.vercel-storage.com` URLs are never
 * the client-facing link — serialize to the HQ-gated image route instead.
 */

export const SPARK_OUTPUT_PREFIX = "spark:";
export const PRIVATE_BLOB_OUTPUT_PREFIX = "blob:";

export const GENERATE_JOB_IMAGE_PATH = "/api/generate/jobs";

export type GenerateOutputKind = "spark" | "private-blob" | "public-blob" | "https" | "unknown";

export function gatedJobImagePath(jobId: string, index: number): string {
  return `${GENERATE_JOB_IMAGE_PATH}/${encodeURIComponent(jobId)}/image?i=${index}`;
}

export function sparkOutputRef(jobId: string, index: number, ext: "png" | "mp4" = "png"): string {
  return `${SPARK_OUTPUT_PREFIX}generate-jobs/${jobId}/${index}.${ext}`;
}

export function privateBlobOutputRef(pathname: string): string {
  return `${PRIVATE_BLOB_OUTPUT_PREFIX}${pathname.replace(/^\/+/, "")}`;
}

export function isSparkOutputRef(value: string): boolean {
  return value.startsWith(SPARK_OUTPUT_PREFIX);
}

export function isPrivateBlobOutputRef(value: string): boolean {
  return value.startsWith(PRIVATE_BLOB_OUTPUT_PREFIX);
}

export function parseSparkOutputRef(
  value: string,
): { jobId: string; index: number; ext: "png" | "mp4" } | null {
  if (!isSparkOutputRef(value)) return null;
  const rest = value.slice(SPARK_OUTPUT_PREFIX.length);
  const m = /^generate-jobs\/([^/]+)\/(\d+)\.(png|mp4)$/.exec(rest);
  if (!m) return null;
  return { jobId: m[1], index: Number(m[2]), ext: m[3] as "png" | "mp4" };
}

export function parsePrivateBlobOutputRef(value: string): string | null {
  if (!isPrivateBlobOutputRef(value)) return null;
  const pathname = value.slice(PRIVATE_BLOB_OUTPUT_PREFIX.length).replace(/^\/+/, "");
  return pathname || null;
}

export function isPublicVercelBlobUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function isPrivateVercelBlobUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith(".private.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export function isVercelBlobUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith(".blob.vercel-storage.com") || host === "blob.vercel-storage.com";
  } catch {
    return false;
  }
}

export function classifyStoredOutput(value: string): GenerateOutputKind {
  const raw = (value || "").trim();
  if (!raw) return "unknown";
  if (isSparkOutputRef(raw)) return "spark";
  if (isPrivateBlobOutputRef(raw) || isPrivateVercelBlobUrl(raw)) return "private-blob";
  if (isPublicVercelBlobUrl(raw)) return "public-blob";
  if (/^https:\/\//i.test(raw)) return "https";
  return "unknown";
}

export function serializeJobOutputUrls(jobId: string, stored: string[] | null | undefined): string[] {
  return (stored ?? [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean)
    .map((_, i) => gatedJobImagePath(jobId, i));
}

export type ClassifiedModalOutputs = {
  sparkRefs: string[];
  privateRefs: string[];
  publicBlobUrls: string[];
  videoUrls: string[];
  pngB64: string[];
  outputsReady: boolean;
};

export function classifyModalOutputs(result: {
  output_urls?: string[] | null;
  output_png_b64?: string[] | null;
  outputs_ready?: boolean | null;
  status?: string | null;
} | null | undefined): ClassifiedModalOutputs {
  const sparkRefs: string[] = [];
  const privateRefs: string[] = [];
  const publicBlobUrls: string[] = [];
  const videoUrls: string[] = [];
  for (const raw of result?.output_urls ?? []) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    const kind = classifyStoredOutput(value);
    if (kind === "spark") sparkRefs.push(value);
    else if (kind === "private-blob") {
      if (isPrivateVercelBlobUrl(value)) {
        try {
          const path = new URL(value).pathname.replace(/^\/+/, "");
          if (path) privateRefs.push(privateBlobOutputRef(path));
        } catch {
          /* skip */
        }
      } else {
        privateRefs.push(value);
      }
    } else if (kind === "public-blob" && isLikelyVideoUrl(value)) {
      videoUrls.push(value);
    } else if (kind === "public-blob") publicBlobUrls.push(value);
    else if (kind === "https" && isLikelyVideoUrl(value)) videoUrls.push(value);
  }
  const pngB64 = (result?.output_png_b64 ?? [])
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
  const outputsReady =
    result?.outputs_ready === true ||
    sparkRefs.length > 0 ||
    privateRefs.length > 0 ||
    publicBlobUrls.length > 0 ||
    videoUrls.length > 0 ||
    pngB64.length > 0;
  return { sparkRefs, privateRefs, publicBlobUrls, videoUrls, pngB64, outputsReady };
}

export function blobReadWriteToken(env: NodeJS.ProcessEnv = process.env): string {
  return (
    env.GENERATE_BLOB_READ_WRITE_TOKEN ||
    env.BLOB_READ_WRITE_TOKEN ||
    ""
  ).trim();
}

export function publicBlobReadWriteToken(env: NodeJS.ProcessEnv = process.env): string {
  return (env.BLOB_READ_WRITE_TOKEN_PUBLIC || env.BLOB_READ_WRITE_TOKEN || "").trim();
}

export function sparkStoreConfig(env: NodeJS.ProcessEnv = process.env): {
  baseUrl: string;
  key: string;
} | null {
  const baseUrl = (env.GENERATE_SPARK_STORE_URL || "").trim().replace(/\/+$/, "");
  const key = (env.GENERATE_SPARK_STORE_KEY || env.QUICKGEN_API_KEY || "").trim();
  if (!baseUrl || !key) return null;
  return { baseUrl, key };
}

export function isSparkStoreConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return sparkStoreConfig(env) !== null;
}

export function isPrivateBlobFallbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.GENERATE_BLOB_FALLBACK || "").trim().toLowerCase();
  return (flag === "1" || flag === "true" || flag === "on") && Boolean(blobReadWriteToken(env));
}

export function parseJobImageIndex(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 7) return null;
  return n;
}

/** Same-origin HQ-gated still, as the studio gallery emits it. */
export function parseGatedJobImagePath(
  value: string,
): { jobId: string; index: number } | null {
  let path = (value || "").trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      path = `${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  }
  const m = /^\/api\/generate\/jobs\/([^/]+)\/image\?i=(\d+)$/.exec(path);
  if (!m) return null;
  const index = parseJobImageIndex(m[2]);
  if (index == null) return null;
  try {
    return { jobId: decodeURIComponent(m[1]), index };
  } catch {
    return null;
  }
}

export function isGatedJobImagePath(value: string): boolean {
  return parseGatedJobImagePath(value) !== null;
}

export function isLikelyVideoUrl(value: string): boolean {
  const raw = (value || "").trim();
  if (!raw) return false;
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(raw)) return true;
  if (raw.startsWith(SPARK_OUTPUT_PREFIX) && raw.endsWith(".mp4")) return true;
  if (raw.startsWith(PRIVATE_BLOB_OUTPUT_PREFIX) && /\.mp4$/i.test(raw)) return true;
  try {
    return new URL(raw).hostname.toLowerCase().includes("fal.media");
  } catch {
    return false;
  }
}

/** HQ-gated still or clip. Same path the gallery emits. */
export function gatedJobMediaPath(jobId: string, index: number): string {
  return gatedJobImagePath(jobId, index);
}
