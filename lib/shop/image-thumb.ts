/**
 * Downscale an image File to a small JPEG dataURL (~10-20KB) for thumbnails.
 * Never throws — falls back to a gray placeholder if the browser can't decode
 * the format (e.g. HEIC on desktop Chrome). Full-res bytes stay in the File;
 * only this tiny thumb is retained for previews, keeping mobile memory flat.
 */

// 1x1 gray JPEG, shown when decode fails
const PLACEHOLDER =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

function drawToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number,
  maxDim: number,
  quality: number
): string {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

async function viaImageBitmap(file: File, maxDim: number, quality: number): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return drawToDataUrl(bitmap, bitmap.width, bitmap.height, maxDim, quality);
  } finally {
    bitmap.close();
  }
}

async function viaImgElement(file: File, maxDim: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = document.createElement("img");
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image decode failed"));
      el.src = url;
    });
    return drawToDataUrl(img, img.naturalWidth, img.naturalHeight, maxDim, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function makeThumbnail(file: File, maxDim = 200, quality = 0.7): Promise<string> {
  try {
    if (typeof createImageBitmap === "function") {
      return await viaImageBitmap(file, maxDim, quality);
    }
  } catch {
    // fall through to <img> path
  }
  try {
    return await viaImgElement(file, maxDim, quality);
  } catch {
    return PLACEHOLDER;
  }
}
