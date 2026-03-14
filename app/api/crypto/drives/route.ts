import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function checkSyncSecret(request: NextRequest): boolean {
  const secret = request.headers.get("x-sync-secret");
  return !!secret && secret === process.env.SYNC_SECRET;
}

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const scans = await prisma.cryptoDriveScan.findMany({
    orderBy: { scannedAt: "desc" },
    include: {
      items: {
        select: { id: true, category: true, sensitivity: true, verified: true, archived: true },
      },
    },
  });

  return NextResponse.json({
    scans: scans.map((s) => ({
      id: s.id,
      label: s.label,
      devicePath: s.devicePath,
      filesystem: s.filesystem,
      totalSizeGb: s.totalSizeGb,
      serialNumber: s.serialNumber,
      scanStatus: s.scanStatus,
      scanDuration: s.scanDuration,
      itemCount: s.itemCount,
      notes: s.notes,
      scannedAt: s.scannedAt.toISOString(),
      items: s.items,
    })),
  });
}

export async function POST(request: NextRequest) {
  // Auth: admin session OR sync secret
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok && !checkSyncSecret(request)) {
    return adminCheck.response;
  }

  const body = await request.json();
  const { label, devicePath, filesystem, totalSizeGb, serialNumber, scanDuration, scanLog, notes, items } = body;

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const scan = await prisma.cryptoDriveScan.create({
    data: {
      label,
      devicePath: devicePath || null,
      filesystem: filesystem || null,
      totalSizeGb: totalSizeGb ?? null,
      serialNumber: serialNumber || null,
      scanStatus: "complete",
      scanDuration: scanDuration ?? null,
      scanLog: scanLog || null,
      notes: notes || null,
      itemCount: Array.isArray(items) ? items.length : 0,
      items: Array.isArray(items) && items.length > 0
        ? {
            create: items.map((item: any) => ({
              category: item.category,
              subcategory: item.subcategory || null,
              filePath: item.filePath,
              fileSize: item.fileSize ?? null,
              fileMtime: item.fileMtime ? new Date(item.fileMtime) : null,
              contentPreview: item.contentPreview || null,
              extractedData: item.extractedData || null,
              sensitivity: item.sensitivity || "normal",
              localCopyPath: item.localCopyPath || null,
              notes: item.notes || null,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  return NextResponse.json({ scan }, { status: 201 });
}
