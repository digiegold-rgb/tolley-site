import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

/**
 * Client-direct upload token for short product videos. Mirrors the shop
 * photo flow at /api/shop/upload-token but accepts MP4/MOV up to 200MB.
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
            "video/mp4",
            "video/quicktime",
            "video/webm",
          ],
          maximumSizeInBytes: 200 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[shop/video-upload] stored:", blob.url, blob.pathname);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[shop/video-upload-token] error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
