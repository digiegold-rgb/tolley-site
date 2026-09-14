/** Internal provider cost estimates, USD. Rates checked 2026-09-14.
 * No retail markup, credits, storage, director chat or post-processing included.
 * Keep these aligned with the actual adapters, not the marketing model aliases.
 */
export const COST_CHECKED = "2026-09-14";
export const COST_SOURCES = {
  flux: "https://fal.ai/models/fal-ai/flux/dev",
  schnell: "https://fal.ai/models/fal-ai/flux/schnell",
  wan: "https://fal.ai/models/fal-ai/wan-i2v",
  wanText: "https://fal.ai/models/fal-ai/wan-t2v",
  wan30: "https://fal.ai/models/alibaba/wan-3.0/image-to-video",
  wan30Text: "https://fal.ai/models/alibaba/wan-3.0/text-to-video",
  seedance: "https://fal.ai/models/bytedance/seedance-2.0/reference-to-video",
  kling: "https://fal.ai/models/fal-ai/kling-video/v3/pro/image-to-video",
  modal: "https://modal.com/pricing",
};
export function usd(value: number): string {
  return `$${value.toFixed(value > 0 && value < 0.01 ? 3 : 2)}`;
}
export function costRange(low: number, high?: number): string {
  return high != null && Math.abs(high - low) > 0.0001 ? `${usd(low)}–${usd(high)}` : usd(low);
}
// Explicit pixel sizes sent to fal; billing rounds each image up to a whole MP.
export const FLUX_PIXELS = {
  "9:16": { width: 768, height: 1344 },
  "16:9": { width: 1344, height: 768 },
  "1:1": { width: 1024, height: 1024 },
} as const;
export function imageCost(model: string, aspect: keyof typeof FLUX_PIXELS): number {
  const { width, height } = FLUX_PIXELS[aspect];
  return Math.ceil(width * height / 1_000_000) * (model === "flux-schnell" ? 0.003 : 0.025);
}
export function motionCost(model: string | undefined, seconds: number, resolution = "720p"): number {
  return model === "wan30-i2v" || model === "wan30-t2v"
    ? Math.round(Math.round(seconds) * (resolution === "1080p" ? 0.2 : resolution === "480p" ? 0.05 : 0.1) * 100) / 100
    : 0.4;
}
/** Editable runtime assumption, not a benchmark. Includes cold startup in minutes.
 * Modal Function: A100-80GB + 64 GiB RAM + minimum .125 physical CPU cores.
 * Actual CPU/memory usage may exceed reservations; no measured timing yet.
 */
export function modalCost(minutesPerImage: number, count: number): number {
  return Math.max(0, minutesPerImage) * Math.max(1, count) * 60 * (0.000694 + 64 * 0.00000222 + 0.125 * 0.0000131);
}
export const SEEDANCE_RATE_720P = 0.3034;
export function cinemaClipCost({ model, seconds, audio = true, resolution = "720p", videoInput = false }: {
  model: string; seconds: number; audio?: boolean; resolution?: string; videoInput?: boolean;
}): { low: number; high?: number } {
  if (model === "kling") return { low: seconds * (audio ? 0.168 : 0.112) };
  // Token-based model. 480p is a proportional estimate; exact output dimensions
  // and up to 15s combined reference-video duration determine the invoice.
  const rate = resolution === "1080p" ? 0.682 : resolution === "480p" ? SEEDANCE_RATE_720P * (480 / 720) ** 2 : SEEDANCE_RATE_720P;
  return videoInput ? { low: seconds * rate * 0.6, high: (seconds + 15) * rate * 0.6 } : { low: seconds * rate };
}
