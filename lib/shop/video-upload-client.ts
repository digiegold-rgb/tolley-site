import { upload } from "@vercel/blob/client";

/**
 * Upload a short product video directly from the browser to Vercel Blob.
 * Mirrors `uploadShopPhoto` but uses the video token endpoint and routes
 * into the `shop/videos/` blob namespace.
 */
export async function uploadShopVideo(file: File): Promise<string> {
  const rawName = file.name || "video";
  const extMatch = rawName.match(/\.(mp4|mov|webm)$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : ".mp4";
  const safeName = `${Date.now()}-vid${ext}`;

  const blob = await upload(`shop/videos/${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/shop/video-upload-token",
    contentType: file.type || "video/mp4",
  });

  return blob.url;
}
