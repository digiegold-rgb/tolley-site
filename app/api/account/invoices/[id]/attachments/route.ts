export const runtime = "nodejs";

/**
 * POST  /api/account/invoices/[id]/attachments
 *   JSON body { blobUrl, fileName, mimeType, size }. The browser uploads the
 *   file directly to Vercel Blob via /upload-token, then calls this route to
 *   persist the InvoiceAttachment row. Avoids the ~4.5MB Serverless body
 *   limit that 413's any real-world Genius Scan PDF or phone photo.
 *
 * GET   /api/account/invoices/[id]/attachments
 *   returns all attachments for the invoice, newest first.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf"];

function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some((p) =>
    p.endsWith("/") ? mime.startsWith(p) : mime === p,
  );
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const attachments = await prisma.invoiceAttachment.findMany({
    where: { invoiceId: id },
    orderBy: { uploadedAt: "desc" },
  });
  return NextResponse.json({ attachments });
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  let payload: {
    blobUrl?: unknown;
    fileName?: unknown;
    mimeType?: unknown;
    size?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Expected JSON { blobUrl, fileName, mimeType, size }." },
      { status: 400 },
    );
  }

  const blobUrl = typeof payload.blobUrl === "string" ? payload.blobUrl : "";
  const fileName = typeof payload.fileName === "string" ? payload.fileName : "";
  const mimeType =
    typeof payload.mimeType === "string"
      ? payload.mimeType
      : "application/octet-stream";
  const size = typeof payload.size === "number" ? payload.size : 0;

  if (!blobUrl || !blobUrl.startsWith("https://")) {
    return NextResponse.json(
      { error: "blobUrl missing or invalid." },
      { status: 400 },
    );
  }
  if (!fileName) {
    return NextResponse.json({ error: "fileName required." }, { status: 400 });
  }
  if (size <= 0 || size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Invalid size — must be 1..${MAX_BYTES} bytes.` },
      { status: 400 },
    );
  }
  if (!isAllowedMime(mimeType)) {
    return NextResponse.json(
      {
        error:
          "Only images (JPEG/PNG/HEIC/WebP) and PDFs are allowed for invoice attachments.",
      },
      { status: 400 },
    );
  }

  const row = await prisma.invoiceAttachment.create({
    data: {
      invoiceId: id,
      fileName,
      mimeType,
      size,
      blobUrl,
    },
  });

  return NextResponse.json({ attachment: row }, { status: 201 });
}
