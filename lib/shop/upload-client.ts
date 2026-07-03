import { upload } from "@vercel/blob/client";

/**
 * Upload a file directly from the browser to Vercel Blob storage.
 * Bypasses the ~4.5MB serverless body limit that blocks full-resolution
 * camera-roll photos.
 *
 * Throws on failure — caller handles the error UI.
 */
export async function uploadShopPhoto(file: File): Promise<string> {
  // Sanitize filename so odd characters don't break the Blob path
  const rawName = file.name || "photo";
  const extMatch = rawName.match(/\.(jpe?g|png|heic|heif|webp|gif)$/i);
  const ext = extMatch ? extMatch[0].toLowerCase() : ".jpg";
  const safeName = `${Date.now()}-img${ext}`;

  const blob = await upload(`shop/${safeName}`, file, {
    access: "public",
    handleUploadUrl: "/api/shop/upload-token",
    contentType: file.type || "image/jpeg",
  });

  return blob.url;
}
