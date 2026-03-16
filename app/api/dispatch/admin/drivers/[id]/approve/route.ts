import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/twilio";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body.action || "approve"; // approve | suspend | deactivate

  const statusMap: Record<string, string> = {
    approve: "approved",
    suspend: "suspended",
    deactivate: "deactivated",
  };

  const newStatus = statusMap[action];
  if (!newStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const driver = await prisma.deliveryDriver.update({
    where: { id },
    data: {
      status: newStatus,
      notes: body.notes || undefined,
    },
  });

  // Notify driver
  if (newStatus === "approved") {
    await sendSms(
      driver.phone,
      `🎉 Welcome to Red Alert Dispatch, ${driver.name}! ` +
      `Your driver account is approved. Go online at tolley.io/drive/driver to start earning.`
    ).catch(() => {});
  }

  return NextResponse.json(driver);
}
