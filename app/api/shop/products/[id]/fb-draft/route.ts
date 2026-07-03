import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { FB_CATEGORY_MAP, type ShopCategory } from "@/lib/shop";

// Keep nodejs runtime for Prisma access. Edge runtime doesn't support Prisma.
export const runtime = "nodejs";
export const maxDuration = 500;

// All FB Marketplace drafts publish as "New" per shop policy — Ruthann's
// inventory is largely sealed/unused stock, and buyers filter for New.
// To revert to per-product mapping, restore the old table and use
// FB_CONDITION_LABELS[product.condition || "good"].
const FB_DRAFT_CONDITION = "New";

interface WorkerSuccess {
  ok: true;
  draftUrl: string | null;
  screenshotBase64?: string;
  elapsedMs: number;
}

interface WorkerFailure {
  ok: false;
  stage: string;
  message: string;
  screenshotBase64?: string;
  elapsedMs?: number;
}

type WorkerResult = WorkerSuccess | WorkerFailure;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawWorkerUrl = process.env.FB_DRAFT_WORKER_URL;
  const rawWorkerSecret = process.env.FB_DRAFT_SECRET;
  if (!rawWorkerUrl || !rawWorkerSecret) {
    return NextResponse.json(
      { error: "FB_DRAFT_WORKER_URL or FB_DRAFT_SECRET not configured" },
      { status: 500 }
    );
  }
  // Defensive: trim in case the env var has trailing whitespace from a
  // previous bad set. Also removes any stray \n / \r.
  const workerUrl = rawWorkerUrl.trim().replace(/\/+$/, "");
  const workerSecret = rawWorkerSecret.trim();

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (!product.imageUrls || product.imageUrls.length === 0) {
    return NextResponse.json(
      { error: "Product has no images" },
      { status: 400 }
    );
  }

  const price =
    product.targetPrice ?? product.minPrice ?? product.aiSuggestedPrice;
  if (!price || price <= 0) {
    return NextResponse.json(
      { error: "Product has no price set" },
      { status: 400 }
    );
  }

  const category = (product.category as ShopCategory) || "Other";
  const fbCategory = FB_CATEGORY_MAP[category] || "Home & Garden";
  const fbCondition = FB_DRAFT_CONDITION;

  const payload = {
    productId: product.id,
    title: product.title,
    description: product.description || "",
    price: Math.round(price),
    category: fbCategory,
    condition: fbCondition,
    imageUrls: product.imageUrls,
  };

  // Find or prepare the existing PlatformListing row
  const existing = await prisma.platformListing.findUnique({
    where: {
      productId_platform: {
        productId: product.id,
        platform: "fb_marketplace",
      },
    },
  });
  const attempts = ((existing?.meta as { attempts?: number } | null)?.attempts || 0) + 1;

  let workerResult: WorkerResult;
  const targetUrl = `${workerUrl}/draft`;

  /**
   * Calls the worker and returns a parsed WorkerResult or a transport-level
   * failure. Used by the retry loop below.
   */
  async function callWorker(): Promise<{
    result: WorkerResult;
    httpStatus: number;
  }> {
    // Unique query-string defeats any edge-level cache of a prior 404 response
    const busted = `${targetUrl}?t=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch(busted, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workerSecret}`,
        // Browser UA — Cloudflare's bot management was silently dropping
        // Vercel's default `node/undici` UA.
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        "Cache-Control": "no-cache",
        Connection: "close",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(270000),
    });
    const rawBody = await res.text();
    // Log full response envelope for transient debugging
    console.log(
      `[fb-draft] worker response: status=${res.status} ` +
        `headers=${JSON.stringify({
          server: res.headers.get("server"),
          cf: res.headers.get("cf-ray"),
          ct: res.headers.get("content-type"),
          cl: res.headers.get("content-length"),
        })} ` +
        `bodyLen=${rawBody.length} bodyHead=${JSON.stringify(rawBody.slice(0, 200))}`
    );
    let parsed: WorkerResult;
    try {
      parsed = JSON.parse(rawBody) as WorkerResult;
    } catch {
      parsed = {
        ok: false,
        stage: "transport",
        message: `Worker returned non-JSON (status ${res.status}): ${rawBody.slice(0, 200)}`,
      };
    }
    if (!res.ok && parsed.ok !== false) {
      parsed = {
        ok: false,
        stage: "transport",
        message: `Worker returned ${res.status} from ${targetUrl}`,
      };
    }
    return { result: parsed, httpStatus: res.status };
  }

  /**
   * Is this a transient error worth retrying?
   * - transport stage with 404/5xx → cloudflare edge flakiness
   * - transport stage with empty body → same
   * - NOT: worker-level stages (auth, selector, verify) — those need human action
   */
  function shouldRetry(
    result: WorkerResult,
    httpStatus: number
  ): boolean {
    if (result.ok) return false;
    if (result.stage !== "transport") return false;
    return [404, 408, 502, 503, 504, 521, 522, 523, 524].includes(httpStatus);
  }

  console.log(`[fb-draft] hitting worker: ${targetUrl}`);
  try {
    // Up to 3 attempts with exponential backoff on transient Cloudflare
    // errors. The worker is idempotent via PlatformListing upsert on
    // (productId, platform), so duplicate requests are safe.
    const BACKOFFS_MS = [1500, 4000, 9000];
    let call = await callWorker();
    workerResult = call.result;

    for (
      let attempt = 0;
      attempt < BACKOFFS_MS.length && shouldRetry(workerResult, call.httpStatus);
      attempt++
    ) {
      const delay = BACKOFFS_MS[attempt];
      console.log(
        `[fb-draft] transient failure (${call.httpStatus}), attempt ${attempt + 2}/${BACKOFFS_MS.length + 1} in ${delay}ms…`
      );
      await new Promise((r) => setTimeout(r, delay));
      call = await callWorker();
      workerResult = call.result;
    }

    console.log(
      `[fb-draft] worker result ok=${workerResult.ok} stage=${
        "stage" in workerResult ? workerResult.stage : "-"
      }`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.platformListing.upsert({
      where: {
        productId_platform: { productId: product.id, platform: "fb_marketplace" },
      },
      create: {
        productId: product.id,
        platform: "fb_marketplace",
        price: Math.round(price),
        status: "draft",
        meta: {
          attempts,
          lastError: message,
          lastStage: "network",
          lastAttemptAt: new Date().toISOString(),
        },
      },
      update: {
        meta: {
          attempts,
          lastError: message,
          lastStage: "network",
          lastAttemptAt: new Date().toISOString(),
        },
      },
    });
    return NextResponse.json(
      { error: "Worker unreachable", detail: message },
      { status: 502 }
    );
  }

  if (!workerResult.ok) {
    await prisma.platformListing.upsert({
      where: {
        productId_platform: { productId: product.id, platform: "fb_marketplace" },
      },
      create: {
        productId: product.id,
        platform: "fb_marketplace",
        price: Math.round(price),
        status: "draft",
        meta: {
          attempts,
          lastError: workerResult.message,
          lastStage: workerResult.stage,
          lastAttemptAt: new Date().toISOString(),
        },
      },
      update: {
        meta: {
          attempts,
          lastError: workerResult.message,
          lastStage: workerResult.stage,
          lastAttemptAt: new Date().toISOString(),
        },
      },
    });
    return NextResponse.json(
      {
        error: "Worker reported failure",
        stage: workerResult.stage,
        detail: workerResult.message,
      },
      { status: 500 }
    );
  }

  // Success — persist the draft state
  const listing = await prisma.platformListing.upsert({
    where: {
      productId_platform: { productId: product.id, platform: "fb_marketplace" },
    },
    create: {
      productId: product.id,
      platform: "fb_marketplace",
      price: Math.round(price),
      externalUrl: workerResult.draftUrl || null,
      status: "draft",
      listedAt: new Date(),
      meta: {
        attempts,
        draftUrl: workerResult.draftUrl,
        elapsedMs: workerResult.elapsedMs,
        lastAttemptAt: new Date().toISOString(),
      },
    },
    update: {
      externalUrl: workerResult.draftUrl || null,
      status: "draft",
      listedAt: new Date(),
      meta: {
        attempts,
        draftUrl: workerResult.draftUrl,
        elapsedMs: workerResult.elapsedMs,
        lastAttemptAt: new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({
    listingId: listing.id,
    draftUrl: workerResult.draftUrl,
    status: "draft",
  });
}
