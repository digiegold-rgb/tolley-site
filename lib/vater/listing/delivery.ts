import type { ListingSku } from "../listing-pricing";

export function listingStartPlan(sku: ListingSku) {
  if (sku === "beauty_shot") return { dgxSku: "beauty", status: "rendering" } as const;
  if (sku === "virtual_staging" || sku === "before_after") {
    return { dgxSku: "staging", status: "staging" } as const;
  }
  throw new Error("This listing product is not available yet.");
}

function assetUrl(value: unknown): boolean {
  return typeof value === "string" && /^(https?:\/\/|\/(?!\/))\S+$/.test(value);
}

/** A renderer's `done` flag does not establish that it delivered a file. */
export function listingDeliveryError(
  phase: "staging" | "rendering" | "finishing",
  assets: unknown,
): string | null {
  const a = assets && typeof assets === "object" && !Array.isArray(assets)
    ? assets as Record<string, unknown> : {};
  if (phase === "staging") {
    return assetUrl(a.stagedStillUrl) && assetUrl(a.stagedStillLabeledUrl)
      ? null : "The generated photo could not be delivered. No image is available to approve.";
  }
  const video = phase === "finishing" ? a.videoUrl || a.videoVerticalUrl : a.videoUrl;
  return assetUrl(video) ? null : "The generated video could not be delivered.";
}

export function needsListingDeliveryRecovery(job: {
  status?: string | null;
  sku?: string | null;
  stagedStillUrl?: string | null;
  stagedStillLabeledUrl?: string | null;
}): boolean {
  return job.status === "awaiting_approval" && job.sku !== "beauty_shot"
    && listingDeliveryError("staging", job) !== null;
}
