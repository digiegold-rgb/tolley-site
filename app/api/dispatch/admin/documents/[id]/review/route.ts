import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";
import { isDriverCompliant, DOC_LABELS, type DocumentType } from "@/lib/dispatch/compliance";

export const runtime = "nodejs";

/** POST — Approve or reject a document */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action as string; // "approve" | "reject"
  const rejectedReason = body.reason as string | undefined;
  const expiresAt = body.expiresAt as string | undefined;
  const docNumber = body.docNumber as string | undefined;
  const holderName = body.holderName as string | undefined;
  const issueState = body.issueState as string | undefined;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  const doc = await prisma.driverDocument.findUnique({
    where: { id },
    include: { driver: { select: { id: true, name: true, phone: true, status: true } } },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const label = DOC_LABELS[doc.type as DocumentType] || doc.type;

  if (action === "approve") {
    await prisma.driverDocument.update({
      where: { id },
      data: {
        status: "approved",
        reviewedBy: check.session.userId,
        reviewedAt: new Date(),
        rejectedReason: null,
        ...(expiresAt && { expiresAt: new Date(expiresAt) }),
        ...(docNumber && { docNumber }),
        ...(holderName && { holderName }),
        ...(issueState && { issueState }),
      },
    });

    // Check if driver is now fully compliant
    const compliance = await isDriverCompliant(doc.driver.id);

    await sendSms(
      doc.driver.phone,
      `✅ Your ${label} has been approved!` +
        (compliance.compliant
          ? "\nAll documents verified — you're cleared to drive."
          : `\nStill needed: ${[...compliance.missing, ...compliance.pending].map(
              (t) => DOC_LABELS[t as DocumentType] || t
            ).join(", ")}`)
    ).catch(() => {});

    return NextResponse.json({ status: "approved", compliant: compliance.compliant });
  }

  // Reject
  if (!rejectedReason) {
    return NextResponse.json({ error: "Rejection reason required" }, { status: 400 });
  }

  await prisma.driverDocument.update({
    where: { id },
    data: {
      status: "rejected",
      reviewedBy: check.session.userId,
      reviewedAt: new Date(),
      rejectedReason,
    },
  });

  await sendSms(
    doc.driver.phone,
    `❌ Your ${label} was not accepted.\nReason: ${rejectedReason}\n` +
      `Please upload a new document: tolley.io/drive/driver/documents`
  ).catch(() => {});

  return NextResponse.json({ status: "rejected" });
}
