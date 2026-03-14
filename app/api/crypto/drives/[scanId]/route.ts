import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { scanId } = await params;

  const scan = await prisma.cryptoDriveScan.findUnique({
    where: { id: scanId },
    include: {
      items: { orderBy: [{ sensitivity: "asc" }, { category: "asc" }] },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: scan.id,
    label: scan.label,
    devicePath: scan.devicePath,
    filesystem: scan.filesystem,
    totalSizeGb: scan.totalSizeGb,
    serialNumber: scan.serialNumber,
    scanStatus: scan.scanStatus,
    scanDuration: scan.scanDuration,
    scanLog: scan.scanLog,
    itemCount: scan.itemCount,
    notes: scan.notes,
    scannedAt: scan.scannedAt.toISOString(),
    items: scan.items.map((item) => ({
      id: item.id,
      category: item.category,
      subcategory: item.subcategory,
      filePath: item.filePath,
      fileSize: item.fileSize,
      fileMtime: item.fileMtime?.toISOString() || null,
      contentPreview: item.contentPreview,
      extractedData: item.extractedData,
      sensitivity: item.sensitivity,
      verified: item.verified,
      archived: item.archived,
      localCopyPath: item.localCopyPath,
      notes: item.notes,
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { scanId } = await params;
  const body = await request.json();

  // Update scan-level fields
  if (body.notes !== undefined || body.scanStatus !== undefined) {
    await prisma.cryptoDriveScan.update({
      where: { id: scanId },
      data: {
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.scanStatus !== undefined && { scanStatus: body.scanStatus }),
      },
    });
  }

  // Update individual items
  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (!item.id) continue;
      await prisma.cryptoDriveItem.update({
        where: { id: item.id },
        data: {
          ...(item.verified !== undefined && { verified: item.verified }),
          ...(item.archived !== undefined && { archived: item.archived }),
          ...(item.notes !== undefined && { notes: item.notes }),
        },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
