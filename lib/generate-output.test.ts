import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyModalOutputs,
  classifyStoredOutput,
  gatedJobImagePath,
  isGatedJobImagePath,
  isLikelyVideoUrl,
  isPrivateBlobFallbackEnabled,
  isPublicVercelBlobUrl,
  isSparkStoreConfigured,
  parseGatedJobImagePath,
  parseJobImageIndex,
  parseSparkOutputRef,
  privateBlobOutputRef,
  serializeJobOutputUrls,
  sparkOutputRef,
  sparkStoreConfig,
} from "./generate-output.ts";
import { persistPngsToSpark } from "./generate-output-persist.ts";

describe("serializeJobOutputUrls", () => {
  it("rewrites every stored ref to the HQ-gated image route", () => {
    const urls = serializeJobOutputUrls("job1", [
      "https://7c7wlwtbdnayflas.public.blob.vercel-storage.com/generate/job1/0.png",
      sparkOutputRef("job1", 1),
      privateBlobOutputRef("generate/job1/2.png"),
    ]);
    assert.deepEqual(urls, [
      "/api/generate/jobs/job1/image?i=0",
      "/api/generate/jobs/job1/image?i=1",
      "/api/generate/jobs/job1/image?i=2",
    ]);
    assert.equal(urls.some((u) => /public\.blob\.vercel-storage/.test(u)), false);
  });

  it("returns an empty list when there are no stills", () => {
    assert.deepEqual(serializeJobOutputUrls("job1", []), []);
  });
});

describe("classifyStoredOutput", () => {
  it("labels public Blob CDN URLs so they are never treated as durable", () => {
    assert.equal(
      classifyStoredOutput("https://abc.public.blob.vercel-storage.com/generate/x/0.png"),
      "public-blob",
    );
    assert.equal(isPublicVercelBlobUrl("https://abc.public.blob.vercel-storage.com/x.png"), true);
    assert.equal(classifyStoredOutput(sparkOutputRef("j", 0)), "spark");
    assert.equal(classifyStoredOutput(privateBlobOutputRef("generate/j/0.png")), "private-blob");
    assert.equal(
      classifyStoredOutput("https://abc.private.blob.vercel-storage.com/generate/j/0.png"),
      "private-blob",
    );
  });
});

describe("classifyModalOutputs", () => {
  it("keeps spark/private refs, isolates public Blob URLs, and reads b64", () => {
    const got = classifyModalOutputs({
      output_urls: [
        sparkOutputRef("j1", 0),
        "https://x.public.blob.vercel-storage.com/generate/j1/1.png",
        "https://x.private.blob.vercel-storage.com/generate/j1/2.png",
        "https://fal.media/files/clip.mp4",
      ],
      output_png_b64: ["aGVsbG8="],
    });
    assert.deepEqual(got.sparkRefs, [sparkOutputRef("j1", 0)]);
    assert.deepEqual(got.publicBlobUrls, [
      "https://x.public.blob.vercel-storage.com/generate/j1/1.png",
    ]);
    assert.deepEqual(got.privateRefs, [privateBlobOutputRef("generate/j1/2.png")]);
    assert.deepEqual(got.pngB64, ["aGVsbG8="]);
    assert.deepEqual(got.videoUrls, ["https://fal.media/files/clip.mp4"]);
    assert.equal(got.outputsReady, true);
  });

  it("is not ready when the webhook is only a completion ping", () => {
    const got = classifyModalOutputs({ status: "done", outputs_ready: true });
    assert.equal(got.outputsReady, true);
    assert.deepEqual(got.pngB64, []);
    assert.deepEqual(got.sparkRefs, []);
  });
});

describe("spark store config", () => {
  it("requires URL + key and prefers GENERATE_SPARK_STORE_KEY", () => {
    assert.equal(isSparkStoreConfigured({}), false);
    assert.deepEqual(
      sparkStoreConfig({
        GENERATE_SPARK_STORE_URL: "https://quickgen.tolley.io/",
        GENERATE_SPARK_STORE_KEY: "k",
      }),
      { baseUrl: "https://quickgen.tolley.io", key: "k" },
    );
    assert.equal(
      isSparkStoreConfigured({
        GENERATE_SPARK_STORE_URL: "https://spark.example",
        QUICKGEN_API_KEY: "qk",
      }),
      true,
    );
  });

  it("enables Blob fallback only when GENERATE_BLOB_FALLBACK=1 and a token exists", () => {
    const spark = {
      GENERATE_SPARK_STORE_URL: "https://spark.example",
      GENERATE_SPARK_STORE_KEY: "k",
      BLOB_READ_WRITE_TOKEN: "tok",
    };
    assert.equal(isPrivateBlobFallbackEnabled(spark), false);
    assert.equal(isPrivateBlobFallbackEnabled({ BLOB_READ_WRITE_TOKEN: "tok" }), false);
    assert.equal(isPrivateBlobFallbackEnabled({ ...spark, GENERATE_BLOB_FALLBACK: "1" }), true);
    assert.equal(
      isPrivateBlobFallbackEnabled({ BLOB_READ_WRITE_TOKEN: "tok", GENERATE_BLOB_FALLBACK: "1" }),
      true,
    );
  });
});

describe("parse helpers", () => {
  it("parses spark refs and image indexes", () => {
    assert.deepEqual(parseSparkOutputRef(sparkOutputRef("abc", 2)), { jobId: "abc", index: 2 });
    assert.equal(parseSparkOutputRef("spark:nope"), null);
    assert.equal(parseJobImageIndex("0"), 0);
    assert.equal(parseJobImageIndex("9"), null);
    assert.equal(gatedJobImagePath("id/x", 0), "/api/generate/jobs/id%2Fx/image?i=0");
    assert.deepEqual(parseGatedJobImagePath("/api/generate/jobs/clxyz/image?i=1"), {
      jobId: "clxyz",
      index: 1,
    });
    assert.equal(isGatedJobImagePath("https://tolley.io/api/generate/jobs/clxyz/image?i=0"), true);
    assert.equal(isLikelyVideoUrl("https://v3.fal.media/files/x.mp4"), true);
    assert.equal(isLikelyVideoUrl("https://cdn.example/still.png"), false);
  });
});

describe("persistPngsToSpark", () => {
  it("PUTs PNG bytes with the store bearer and returns spark refs", async () => {
    const calls: { url: string; method?: string; headers: HeadersInit | undefined }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method, headers: init?.headers });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
    const refs = await persistPngsToSpark(
      "job9",
      [Buffer.from("png")],
      {
        GENERATE_SPARK_STORE_URL: "https://quickgen.tolley.io",
        GENERATE_SPARK_STORE_KEY: "secret",
      },
      fetchImpl,
    );
    assert.deepEqual(refs, [sparkOutputRef("job9", 0)]);
    assert.equal(calls[0]?.url, "https://quickgen.tolley.io/generate-jobs/job9/0");
    assert.equal(calls[0]?.method, "PUT");
    const headers = new Headers(calls[0]?.headers);
    assert.equal(headers.get("authorization"), "Bearer secret");
  });
});
