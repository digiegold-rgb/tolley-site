import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findMatchingDrivers } from "@/lib/dispatch/matching";
import { notifyDriversOfOrder, notifyAdminEscalation, notifyClientNoMatch } from "@/lib/dispatch/sms";
import { DISPATCH_MATCHING, DISPATCH_STATUS } from "@/lib/dispatch/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/dispatch/match — AI driver matching (internal, SYNC_SECRET auth)
 */
export async function POST(request: NextRequest) {
  // Auth: SYNC_SECRET or admin
  const authHeader = request.headers.get("authorization");
  const syncSecret = process.env.SYNC_SECRET;
  if (!syncSecret || authHeader !== `Bearer ${syncSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orderId = body.orderId;

  // If specific order, match just that one. Otherwise, match all pending.
  const orders = orderId
    ? await prisma.deliveryOrder.findMany({
        where: { id: orderId, status: { in: [DISPATCH_STATUS.PENDING, DISPATCH_STATUS.MATCHING] } },
      })
    : await prisma.deliveryOrder.findMany({
        where: { status: { in: [DISPATCH_STATUS.PENDING, DISPATCH_STATUS.MATCHING] } },
        orderBy: [{ urgency: "asc" }, { createdAt: "asc" }],
        take: 10,
      });

  const results: { orderNumber: string; candidateCount: number; log: string }[] = [];

  for (const order of orders) {
    // Parse previous dispatch log for excluded drivers
    const prevLog = order.aiDispatchLog ? JSON.parse(order.aiDispatchLog) : [];
    const excludeIds = prevLog
      .filter((e: { event: string; driverId?: string }) => e.event === "declined" || e.event === "notified")
      .map((e: { driverId?: string }) => e.driverId)
      .filter(Boolean) as string[];

    // Determine radius (widen on retry)
    const radius =
      order.matchAttempts >= 1
        ? DISPATCH_MATCHING.widenRadiusMi
        : DISPATCH_MATCHING.defaultRadiusMi;

    // Determine vehicle requirement from cargo
    let vehicleReq: string | null = null;
    if (order.requiresTrailer) vehicleReq = "trailer";
    else if (order.cargoWeightLbs && order.cargoWeightLbs > 2000) vehicleReq = "flatbed";
    else if (order.cargoWeightLbs && order.cargoWeightLbs > 500) vehicleReq = "pickup";

    const { candidates, log } = await findMatchingDrivers(
      order.pickupLat,
      order.pickupLng,
      vehicleReq,
      order.cargoWeightLbs,
      radius,
      excludeIds
    );

    // Bump driver pay on retries
    let effectiveDriverPay = order.driverPay;
    if (order.matchAttempts > 0) {
      effectiveDriverPay = Math.round(
        order.driverPay * (1 + DISPATCH_MATCHING.payBumpPercent * order.matchAttempts) * 100
      ) / 100;
    }

    if (candidates.length > 0) {
      // SMS top candidates
      await notifyDriversOfOrder(
        { ...order, driverPay: effectiveDriverPay },
        candidates.map((c) => ({
          phone: c.phone,
          name: c.name,
          etaMin: c.etaMin,
        }))
      );

      // Log notifications
      for (const c of candidates) {
        prevLog.push({
          event: "notified",
          driverId: c.driverId,
          driverName: c.name,
          score: c.score,
          distanceMi: c.distanceMi,
          etaMin: c.etaMin,
          at: new Date().toISOString(),
        });
      }
    }

    // Update order
    await prisma.deliveryOrder.update({
      where: { id: order.id },
      data: {
        status: DISPATCH_STATUS.MATCHING,
        matchAttempts: { increment: 1 },
        aiDispatchLog: JSON.stringify(prevLog),
        ...(candidates.length === 0 &&
          order.matchAttempts >= DISPATCH_MATCHING.maxMatchAttempts - 1 && {
            escalatedAt: new Date(),
          }),
      },
    });

    // Handle escalation
    if (
      candidates.length === 0 &&
      order.matchAttempts >= DISPATCH_MATCHING.maxMatchAttempts - 1
    ) {
      await notifyAdminEscalation(order);
      const client = await prisma.deliveryClient.findUnique({
        where: { id: order.clientId },
      });
      if (client) {
        await notifyClientNoMatch(client.phone, order.orderNumber);
      }
    }

    results.push({
      orderNumber: order.orderNumber,
      candidateCount: candidates.length,
      log,
    });
  }

  return NextResponse.json({
    matched: results.length,
    results,
  });
}
