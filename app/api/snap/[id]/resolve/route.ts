import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processSnapRequest } from "@/lib/snap/pipeline";
import { after } from "next/server";

/**
 * POST /api/snap/[id]/resolve
 * User confirms or corrects the detected address, or enters a manual address.
 * Triggers the dossier pipeline.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const snap = await prisma.snapRequest.findUnique({
    where: { id },
  });

  if (!snap || snap.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Don't re-process if already researching or complete
  if (snap.status === "researching" || snap.status === "complete") {
    return NextResponse.json({
      snapId: snap.id,
      dossierJobId: snap.dossierJobId,
      status: snap.status,
    });
  }

  const body = await request.json();
  const { address, city, state, zip } = body;

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 });
  }

  // Update snap with confirmed/corrected address
  await prisma.snapRequest.update({
    where: { id },
    data: {
      resolvedAddress: address,
      resolvedCity: city || null,
      resolvedState: state || "MO",
      resolvedZip: zip || null,
      manualAddress: address,
      status: "researching",
    },
  });

  // Kick off the pipeline in the background
  after(async () => {
    await processSnapRequest(id);
  });

  return NextResponse.json({
    snapId: snap.id,
    status: "researching",
  });
}
