export const runtime = "nodejs";

/**
 * DELETE /api/account/invoices/[id]/attachments/[attId]
 *   Remove the blob from Vercel Blob storage and delete the row. No response
 *   body on success (204).
 */

import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; attId: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const { id, attId } = await ctx.params;
  const attachment = await prisma.invoiceAttachment.findUnique({
    where: { id: attId },
    select: { id: true, invoiceId: true, blobUrl: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }
  if (attachment.invoiceId !== id) {
    // Defensive — the attachment ID belongs to a different invoice.
    return NextResponse.json(
      { error: "Attachment does not belong to this invoice." },
      { status: 403 },
    );
  }

  // Best-effort blob delete. If the blob is already gone (manual cleanup,
  // token rotation, etc.), still delete the row so the UI doesn't ghost it.
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(attachment.blobUrl);
    } catch (err) {
      console.warn(
        `[invoices/attachments] del failed for ${attachment.blobUrl}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  await prisma.invoiceAttachment.delete({ where: { id: attId } });
  return new NextResponse(null, { status: 204 });
}
