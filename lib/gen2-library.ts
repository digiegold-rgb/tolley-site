export function gen2OutputIsVideo(recipe: string | undefined, url: string, index: number): boolean {
  if (/\.(png|jpe?g|webp)(?:[?#]|$)/i.test(url)) return false;
  if (/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url)) return true;
  // Gated URLs have no extension. Video recipes save the clip first and may
  // append an extracted last-frame still used for the following scene.
  return index === 0 && ["fal-wan-t2v", "fal-wan-i2v", "fal-wan-flf2v", "fal-wan-stitch", "fal-kling-elements", "fal-seedance-ref"].includes(recipe || "");
}
