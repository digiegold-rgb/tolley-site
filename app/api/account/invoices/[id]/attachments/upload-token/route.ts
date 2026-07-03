import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const check = await requireAdminApiSession();
        if (!check.ok) throw new Error("Unauthorized");

        const invoice = await prisma.invoice.findUnique({
          where: { id },
          select: { id: true, invoiceNumber: true },
        });
        if (!invoice) throw new Error("Invoice not found");

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif",
            "application/pdf",
          ],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
          }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("[invoice-attachments/upload] blob stored:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[invoice-attachments/upload-token] error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
