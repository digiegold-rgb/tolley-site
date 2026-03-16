import { put } from "@vercel/blob";

/**
 * Download a video from a temporary URL and store it permanently in Vercel Blob.
 * Returns the permanent blob URL, or null if blob storage is unavailable.
 */
export async function persistVideoToBlob(
  tempUrl: string,
  generationId: string,
  contentType?: string,
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  const res = await fetch(tempUrl);
  if (!res.ok) throw new Error(`Failed to fetch video: ${res.status}`);

  const ext = contentType?.includes("webm") ? "webm" : "mp4";
  const filename = `videos/${generationId}.${ext}`;

  const blob = await put(filename, res.body!, {
    access: "public",
    contentType: contentType || "video/mp4",
    addRandomSuffix: false,
  });

  return blob.url;
}
