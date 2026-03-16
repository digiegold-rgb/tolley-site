import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTwilioSignature, sendSms } from "@/lib/twilio";
import { DISPATCH_STATUS } from "@/lib/dispatch/constants";
import {
  notifyClientAccepted,
  notifyDriverOrderTaken,
  notifyClientStatusUpdate,
} from "@/lib/dispatch/sms";
import { chatCompletion } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

function twimlResponse(body?: string) {
  if (!body) {
    return new NextResponse("", { status: 200, headers: { "Content-Type": "text/xml" } });
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}</Message></Response>`;
  return new NextResponse(xml, { status: 200, headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = String(value);
  }

  const from = params.From || "";
  const body = (params.Body || "").trim();

  if (!from || !body) return twimlResponse();

  // Validate Twilio signature
  const signature = request.headers.get("x-twilio-signature") || "";
  const webhookUrl = process.env.DISPATCH_SMS_WEBHOOK_URL || "https://www.tolley.io/api/dispatch/sms/webhook";
  if (process.env.TWILIO_AUTH_TOKEN && signature) {
    if (!validateTwilioSignature(webhookUrl, params, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  const upperBody = body.toUpperCase().trim();

  // Check if sender is a known driver
  const driver = await prisma.deliveryDriver.findUnique({
    where: { phone: from },
  });

  if (driver) {
    return handleDriverSms(driver, upperBody, body);
  }

  // Check if sender is a known client
  const client = await prisma.deliveryClient.findUnique({
    where: { phone: from },
  });

  if (client) {
    return handleClientSms(client, body);
  }

  // Unknown number — prompt signup
  return twimlResponse(
    "Red Alert Dispatch — KC's fastest delivery service.\n" +
    "Need a delivery? Visit tolley.io/drive\n" +
    "Want to drive? Visit tolley.io/drive/register"
  );
}

async function handleDriverSms(
  driver: { id: string; name: string; phone: string },
  upperBody: string,
  rawBody: string
) {
  // YES — accept the most recent matching order they were notified about
  if (upperBody === "YES" || upperBody === "Y" || upperBody === "ACCEPT") {
    // Find matching orders where this driver was notified
    const matchingOrders = await prisma.deliveryOrder.findMany({
      where: {
        status: DISPATCH_STATUS.MATCHING,
        driverId: null,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Find one where this driver appears in the dispatch log
    for (const order of matchingOrders) {
      const log = order.aiDispatchLog ? JSON.parse(order.aiDispatchLog) : [];
      const wasNotified = log.some(
        (e: { event: string; driverId?: string }) =>
          e.event === "notified" && e.driverId === driver.id
      );

      if (wasNotified) {
        // Claim it
        try {
          const updated = await prisma.deliveryOrder.update({
            where: { id: order.id, status: DISPATCH_STATUS.MATCHING },
            data: {
              driverId: driver.id,
              status: DISPATCH_STATUS.ACCEPTED,
              acceptedAt: new Date(),
            },
          });

          // Notify client
          const client = await prisma.deliveryClient.findUnique({
            where: { id: order.clientId },
          });
          if (client) {
            await notifyClientAccepted(
              client.phone,
              driver.name,
              order.durationMin,
              order.orderNumber
            );
          }

          // Notify other notified drivers
          const otherDriverIds = log
            .filter(
              (e: { event: string; driverId?: string }) =>
                e.event === "notified" && e.driverId !== driver.id
            )
            .map((e: { driverId?: string }) => e.driverId)
            .filter(Boolean) as string[];

          for (const otherId of otherDriverIds) {
            const other = await prisma.deliveryDriver.findUnique({
              where: { id: otherId },
            });
            if (other) {
              await notifyDriverOrderTaken(other.phone);
            }
          }

          return twimlResponse(
            `✅ You got it! Order ${order.orderNumber}\n` +
            `Pickup: ${order.pickupAddress}\n` +
            `Dropoff: ${order.dropoffAddress}\n` +
            `Pay: $${order.driverPay.toFixed(2)}\n` +
            `Reply ENROUTE when heading to pickup.`
          );
        } catch {
          // Race condition — another driver got it
          continue;
        }
      }
    }

    return twimlResponse("No available orders right now. We'll text you when one comes in.");
  }

  // NO — decline
  if (upperBody === "NO" || upperBody === "N" || upperBody === "SKIP") {
    return twimlResponse("Got it — you'll get the next one.");
  }

  // Status updates via SMS
  const activeOrder = await prisma.deliveryOrder.findFirst({
    where: {
      driverId: driver.id,
      status: {
        in: ["accepted", "pickup_enroute", "picked_up", "delivering"],
      },
    },
    orderBy: { acceptedAt: "desc" },
  });

  if (activeOrder) {
    const statusMap: Record<string, string> = {
      ENROUTE: "pickup_enroute",
      "ON THE WAY": "pickup_enroute",
      ARRIVED: "picked_up",
      "PICKED UP": "picked_up",
      PICKEDUP: "picked_up",
      DELIVERED: "delivered",
      DONE: "completed",
      COMPLETE: "completed",
    };

    const newStatus = statusMap[upperBody];
    if (newStatus) {
      const statusFlow: Record<string, string> = {
        accepted: "pickup_enroute",
        pickup_enroute: "picked_up",
        picked_up: "delivering",
        delivering: "delivered",
        delivered: "completed",
      };

      const expected = statusFlow[activeOrder.status];
      if (newStatus === expected || newStatus === activeOrder.status) {
        const updates: Record<string, unknown> = { status: newStatus };
        if (newStatus === "picked_up") updates.pickedUpAt = new Date();
        if (newStatus === "delivered") updates.deliveredAt = new Date();
        if (newStatus === "completed") updates.completedAt = new Date();

        await prisma.deliveryOrder.update({
          where: { id: activeOrder.id },
          data: updates,
        });

        const client = await prisma.deliveryClient.findUnique({
          where: { id: activeOrder.clientId },
        });
        if (client) {
          await notifyClientStatusUpdate(
            client.phone,
            newStatus,
            activeOrder.orderNumber
          );
        }

        return twimlResponse(`✅ Status updated: ${newStatus.replace(/_/g, " ")}`);
      }
    }
  }

  // Fallback — AI response
  try {
    const result = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are the Red Alert Dispatch AI assistant helping a delivery driver. " +
            "Keep responses under 160 chars. Be helpful and direct. " +
            "Common commands: YES (accept order), NO (decline), ENROUTE, PICKED UP, DELIVERED, DONE.",
        },
        { role: "user", content: rawBody },
      ],
      { maxTokens: 100, temperature: 0.5, type: "dispatch_driver_sms" }
    );
    return twimlResponse(result.text);
  } catch {
    return twimlResponse(
      "Commands: YES/NO (orders), ENROUTE, PICKED UP, DELIVERED, DONE"
    );
  }
}

async function handleClientSms(
  client: { id: string; contactName: string; phone: string },
  rawBody: string
) {
  // Check for active orders
  const activeOrder = await prisma.deliveryOrder.findFirst({
    where: {
      clientId: client.id,
      status: {
        notIn: ["completed", "cancelled", "failed"],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      driver: { select: { name: true, currentLat: true, currentLng: true } },
    },
  });

  // AI response with context
  const context = activeOrder
    ? `Active order ${activeOrder.orderNumber}: status ${activeOrder.status}` +
      (activeOrder.driver ? `, driver: ${activeOrder.driver.name}` : "") +
      `. Pickup: ${activeOrder.pickupAddress}. Dropoff: ${activeOrder.dropoffAddress}.`
    : "No active orders.";

  try {
    const result = await chatCompletion(
      [
        {
          role: "system",
          content:
            "You are Red Alert Dispatch AI, helping a delivery client. " +
            `Client: ${client.contactName}. ${context} ` +
            "Keep responses under 300 chars. Be helpful. " +
            "For new orders, direct to tolley.io/drive/dashboard/order",
        },
        { role: "user", content: rawBody },
      ],
      { maxTokens: 150, temperature: 0.5, type: "dispatch_client_sms" }
    );
    return twimlResponse(result.text);
  } catch {
    return twimlResponse(
      activeOrder
        ? `Order ${activeOrder.orderNumber}: ${activeOrder.status.replace(/_/g, " ")}. Track at tolley.io/drive/track/${activeOrder.orderNumber}`
        : "Red Alert Dispatch — order at tolley.io/drive"
    );
  }
}
