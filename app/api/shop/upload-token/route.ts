import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

/**
 * Client-direct upload token endpoint. The browser POSTs the file straight
 * to Vercel Blob storage — we only mint/authorize the short-lived token.
 * This bypasses the ~4.5MB serverless body limit that blocks full-res
 * camera-roll photos.
 *
 * Flow:
 *   Browser → POST /api/shop/upload-token (generateClientTokenOnUpload) → {token}
 *   Browser → PUT direct to Blob with token
 *   Blob → POST /api/shop/upload-token (onUploadCompleted) so we can log
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const isAdmin = await validateShopAdmin();
        if (!isAdmin) {
          throw new Error("Unauthorized");
        }
        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/heic",
            "image/heif",
          ],
          maximumSizeInBytes: 25 * 1024 * 1024, // 25MB — comfortable for full iPhone photos
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[shop/upload] blob stored:", blob.url, blob.pathname);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[shop/upload-token] error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
