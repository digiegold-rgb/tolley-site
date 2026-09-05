/**
 * Persist /generate stills Spark-first. Private Vercel Blob is fallback only.
 * Never upload job outputs as a public Blob object.
 */

import { get, put } from "@vercel/blob";

import {
  blobReadWriteToken,
  classifyModalOutputs,
  isPublicVercelBlobUrl,
  isSparkStoreConfigured,
  isPrivateBlobFallbackEnabled,
  parsePrivateBlobOutputRef,
  parseSparkOutputRef,
  privateBlobOutputRef,
  sparkOutputRef,
  sparkStoreConfig,
  type ClassifiedModalOutputs,
} from "./generate-output";

export type PersistFetch = typeof fetch;

export class GenerateOutputPersistError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerateOutputPersistError";
  }
}

function decodePngB64(raw: string): Buffer {
  const buf = Buffer.from(raw, "base64");
  if (!buf.length) throw new GenerateOutputPersistError("empty PNG payload");
  return buf;
}

export async function persistPngsToSpark(
  jobId: string,
  pngs: Buffer[],
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PersistFetch = fetch,
): Promise<string[]> {
  const cfg = sparkStoreConfig(env);
  if (!cfg) {
    throw new GenerateOutputPersistError(
      "Spark store is not configured. Set GENERATE_SPARK_STORE_URL and GENERATE_SPARK_STORE_KEY (see docs/generate-modal.md).",
    );
  }
  const refs: string[] = [];
  for (let i = 0; i < pngs.length; i++) {
    const url = `${cfg.baseUrl}/generate-jobs/${encodeURIComponent(jobId)}/${i}`;
    const res = await fetchImpl(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "x-api-key": cfg.key,
        "Content-Type": "image/png",
      },
      body: new Uint8Array(pngs[i]),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new GenerateOutputPersistError(
        `Spark store PUT failed (${res.status}): ${text.slice(0, 240) || res.statusText}`,
      );
    }
    refs.push(sparkOutputRef(jobId, i));
  }
  return refs;
}

export async function persistPngsToPrivateBlob(
  jobId: string,
  pngs: Buffer[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<string[]> {
  const token = blobReadWriteToken(env);
  if (!token) {
    throw new GenerateOutputPersistError(
      "Private Blob fallback needs GENERATE_BLOB_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN on a private store.",
    );
  }
  const refs: string[] = [];
  for (let i = 0; i < pngs.length; i++) {
    const blob = await put(`generate/${jobId}/${i}.png`, pngs[i], {
      access: "private",
      contentType: "image/png",
      addRandomSuffix: true,
      token,
    });
    if (isPublicVercelBlobUrl(blob.url)) {
      throw new GenerateOutputPersistError(
        "Blob put returned a public URL. Point GENERATE_BLOB_READ_WRITE_TOKEN at a private store (vercel blob create-store … --access private).",
      );
    }
    refs.push(privateBlobOutputRef(blob.pathname || `generate/${jobId}/${i}.png`));
  }
  return refs;
}

export async function persistJobPngs(
  jobId: string,
  pngB64: string[],
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PersistFetch = fetch,
): Promise<string[]> {
  const pngs = pngB64.map(decodePngB64);
  if (!pngs.length) return [];
  if (isSparkStoreConfigured(env)) {
    return persistPngsToSpark(jobId, pngs, env, fetchImpl);
  }
  if (isPrivateBlobFallbackEnabled(env)) {
    return persistPngsToPrivateBlob(jobId, pngs, env);
  }
  throw new GenerateOutputPersistError(
    "No private still store. Set GENERATE_SPARK_STORE_URL + GENERATE_SPARK_STORE_KEY (preferred), or GENERATE_BLOB_FALLBACK=1 with a private Blob token.",
  );
}

export async function relocatePublicBlobUrls(
  jobId: string,
  urls: string[],
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PersistFetch = fetch,
): Promise<string[]> {
  const pngs: Buffer[] = [];
  for (const url of urls) {
    const res = await fetchImpl(url, { cache: "no-store" });
    if (!res.ok) {
      throw new GenerateOutputPersistError(
        `Could not pull public blob still (${res.status}) to relocate it off the public store.`,
      );
    }
    pngs.push(Buffer.from(await res.arrayBuffer()));
  }
  if (!pngs.length) return [];
  if (isSparkStoreConfigured(env)) {
    return persistPngsToSpark(jobId, pngs, env, fetchImpl);
  }
  if (isPrivateBlobFallbackEnabled(env)) {
    return persistPngsToPrivateBlob(jobId, pngs, env);
  }
  throw new GenerateOutputPersistError(
    "Public Blob stills cannot stay as the durable link. Configure the Spark store (or private Blob fallback) and re-run.",
  );
}

export async function resolveDurableOutputUrls(
  jobId: string,
  classified: ClassifiedModalOutputs,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PersistFetch = fetch,
): Promise<string[]> {
  if (classified.sparkRefs.length) return classified.sparkRefs;
  if (classified.privateRefs.length) return classified.privateRefs;
  if (classified.pngB64.length) {
    return persistJobPngs(jobId, classified.pngB64, env, fetchImpl);
  }
  if (classified.publicBlobUrls.length) {
    return relocatePublicBlobUrls(jobId, classified.publicBlobUrls, env, fetchImpl);
  }
  // Motion clips (fal / persisted mp4). Proxied later via the gated job route.
  if (classified.videoUrls.length) return classified.videoUrls;
  return [];
}

export async function durableUrlsFromModalResult(
  jobId: string,
  result: Parameters<typeof classifyModalOutputs>[0],
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PersistFetch = fetch,
): Promise<string[]> {
  return resolveDurableOutputUrls(jobId, classifyModalOutputs(result), env, fetchImpl);
}

export type FetchedJobImage = {
  body: ReadableStream<Uint8Array> | Buffer;
  contentType: string;
};

export async function fetchSparkJobImage(
  jobId: string,
  index: number,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PersistFetch = fetch,
): Promise<FetchedJobImage> {
  const cfg = sparkStoreConfig(env);
  if (!cfg) {
    throw new GenerateOutputPersistError("Spark store is not configured.");
  }
  const url = `${cfg.baseUrl}/generate-jobs/${encodeURIComponent(jobId)}/${index}`;
  const res = await fetchImpl(url, {
    headers: {
      Authorization: `Bearer ${cfg.key}`,
      "x-api-key": cfg.key,
    },
    cache: "no-store",
  });
  if (!res.ok || !res.body) {
    throw new GenerateOutputPersistError(`Spark still not found (${res.status}).`);
  }
  return {
    body: res.body,
    contentType: res.headers.get("content-type") || "image/png",
  };
}

export async function fetchPrivateBlobJobImage(
  pathname: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<FetchedJobImage> {
  const token = blobReadWriteToken(env);
  const result = await get(pathname, {
    access: "private",
    token: token || undefined,
    useCache: false,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new GenerateOutputPersistError("Private Blob still not found.");
  }
  return {
    body: result.stream,
    contentType: result.blob?.contentType || "image/png",
  };
}

export async function fetchStoredJobImage(
  jobId: string,
  stored: string,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: PersistFetch = fetch,
): Promise<FetchedJobImage> {
  const spark = parseSparkOutputRef(stored);
  if (spark) {
    if (spark.jobId !== jobId) {
      throw new GenerateOutputPersistError("Still does not belong to this job.");
    }
    return fetchSparkJobImage(spark.jobId, spark.index, env, fetchImpl);
  }
  const blobPath = parsePrivateBlobOutputRef(stored);
  if (blobPath) {
    return fetchPrivateBlobJobImage(blobPath, env);
  }
  // Legacy public objects: proxy server-side so the browser never sees the CDN URL.
  if (isPublicVercelBlobUrl(stored) || /^https:\/\//i.test(stored)) {
    const res = await fetchImpl(stored, { cache: "no-store" });
    if (!res.ok || !res.body) {
      throw new GenerateOutputPersistError(`Legacy still not reachable (${res.status}).`);
    }
    return {
      body: res.body,
      contentType: res.headers.get("content-type") || "image/png",
    };
  }
  throw new GenerateOutputPersistError("Unknown still storage ref.");
}
