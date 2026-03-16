import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DISPATCH_MATCHING } from "@/lib/dispatch/constants";
import { notifyAdminEscalation, notifyClientNoMatch } from "@/lib/dispatch/sms";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Cron: every 10 minutes — escalate unaccepted orders
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.VERCEL) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cutoff = new Date(
      Date.now() - DISPATCH_MATCHING.escalationTimeoutMin * 60 * 1000
    );

    // Find orders stuck in matching for too long
    const staleOrders = await prisma.deliveryOrder.findMany({
      where: {
        status: "matching",
        escalatedAt: null,
        createdAt: { lte: cutoff },
      },
    });

    let escalated = 0;

    for (const order of staleOrders) {
      await prisma.deliveryOrder.update({
        where: { id: order.id },
        data: { escalatedAt: new Date() },
      });

      await notifyAdminEscalation(order);

      const client = await prisma.deliveryClient.findUnique({
        where: { id: order.clientId },
      });
      if (client) {
        await notifyClientNoMatch(client.phone, order.orderNumber);
      }

      escalated++;
    }

    return NextResponse.json({ ok: true, escalated });
  } catch (err) {
    console.error("[cron/dispatch-stale]", err);
    return NextResponse.json({ error: "Stale cron failed" }, { status: 500 });
  }
}
