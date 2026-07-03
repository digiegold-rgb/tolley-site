import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

/**
 * Client-direct upload token for /social. Browser uploads the video bytes
 * straight to Vercel Blob using the token; the serverless route never
 * touches the file body (avoids the 4.5MB serverless body limit).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const auth = await requireAdminApiSession();
        if (!auth.ok) throw new Error("Unauthorized");
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ email: auth.session.email }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[social/upload-token] stored:", blob.url);
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[social/upload-token] error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
