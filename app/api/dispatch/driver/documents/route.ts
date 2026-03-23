import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { REQUIRED_DOCUMENTS, DOC_LABELS, type DocumentType } from "@/lib/dispatch/compliance";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** GET — List driver's documents with compliance status */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
    include: { documents: true },
  });

  if (!driver) {
    return NextResponse.json({ error: "Not registered" }, { status: 404 });
  }

  // Build status for each required doc type
  const now = new Date();
  const documents = REQUIRED_DOCUMENTS.map((type) => {
    const doc = driver.documents.find((d) => d.type === type);
    let effectiveStatus = doc?.status || "missing";
    if (doc?.status === "approved" && doc.expiresAt && doc.expiresAt < now) {
      effectiveStatus = "expired";
    }
    return {
      type,
      label: DOC_LABELS[type],
      status: effectiveStatus,
      ...(doc && {
        id: doc.id,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName,
        expiresAt: doc.expiresAt,
        docNumber: doc.docNumber,
        holderName: doc.holderName,
        issueState: doc.issueState,
        rejectedReason: doc.rejectedReason,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }),
    };
  });

  const compliant = documents.every((d) => d.status === "approved");

  return NextResponse.json({ documents, compliant });
}

/** POST — Upload a document (DL, insurance, or registration) */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });
  if (!driver) {
    return NextResponse.json({ error: "Not registered" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string;
  const expiresAt = formData.get("expiresAt") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!REQUIRED_DOCUMENTS.includes(type as DocumentType)) {
    return NextResponse.json(
      { error: `Invalid type. Must be: ${REQUIRED_DOCUMENTS.join(", ")}` },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, or PDF files are allowed" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (10MB max)" }, { status: 400 });
  }

  // Upload to Vercel Blob (private folder per driver)
  const ext = file.name.split(".").pop() || "jpg";
  const blobPath = `dispatch/documents/${driver.id}/${type}-${Date.now()}.${ext}`;

  const blob = await put(blobPath, file, {
    access: "public", // URL is unguessable, driver-specific path
    contentType: file.type,
  });

  // Upsert document record (replace old one if exists)
  const doc = await prisma.driverDocument.upsert({
    where: { driverId_type: { driverId: driver.id, type } },
    create: {
      driverId: driver.id,
      type,
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      status: "pending",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    update: {
      fileUrl: blob.url,
      fileName: file.name,
      fileSize: file.size,
      status: "pending",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      rejectedReason: null,
      reviewedBy: null,
      reviewedAt: null,
      warned30d: false,
      warned14d: false,
      warned7d: false,
      warned1d: false,
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
