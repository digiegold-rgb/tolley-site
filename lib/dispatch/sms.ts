import { sendSms } from "@/lib/twilio";
import type { DeliveryOrder, DeliveryDriver } from "@prisma/client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tolley.io";

export async function notifyDriversOfOrder(
  order: DeliveryOrder,
  drivers: { phone: string; name: string; etaMin?: number }[]
): Promise<string[]> {
  const sids: string[] = [];

  for (const driver of drivers) {
    const eta = driver.etaMin ? `${driver.etaMin} min` : "nearby";
    const msg =
      `🔴 RED ALERT: ${order.pickupAddress} → ${order.dropoffAddress}\n` +
      `${order.distanceMi ? `${order.distanceMi} mi | ` : ""}Pay: $${order.driverPay.toFixed(2)}` +
      `${order.cargoDescription ? ` | ${order.cargoDescription}` : ""}\n` +
      `ETA to pickup: ${eta}\n` +
      `Reply YES to accept | NO to skip`;

    try {
      const sid = await sendSms(driver.phone, msg);
      sids.push(sid);
    } catch (err) {
      console.error(`[dispatch] Failed SMS to ${driver.name}:`, err);
    }
  }

  return sids;
}

export async function notifyDriverOrderTaken(phone: string): Promise<void> {
  await sendSms(phone, "Order has been accepted by another driver.").catch(
    () => {}
  );
}

export async function notifyClientAccepted(
  clientPhone: string,
  driverName: string,
  etaMin: number | null,
  orderNumber: string
): Promise<void> {
  const trackUrl = `${SITE_URL}/drive/track/${orderNumber}`;
  const eta = etaMin ? `ETA ${etaMin} min` : "";
  await sendSms(
    clientPhone,
    `✅ Driver ${driverName} accepted your delivery!${eta ? ` ${eta}` : ""}\n` +
      `Track: ${trackUrl}`
  ).catch(() => {});
}

export async function notifyClientStatusUpdate(
  clientPhone: string,
  status: string,
  orderNumber: string,
  extra?: string
): Promise<void> {
  const messages: Record<string, string> = {
    pickup_enroute: "🚗 Driver en route to pickup location.",
    picked_up: "📦 Your items have been picked up! On the way to you.",
    delivered: "✅ Delivered! Photo proof attached.",
    cancelled: "❌ Your delivery has been cancelled.",
    failed: "⚠️ Delivery could not be completed. Our team will follow up.",
  };

  const msg = messages[status];
  if (!msg) return;

  const trackUrl = `${SITE_URL}/drive/track/${orderNumber}`;
  await sendSms(
    clientPhone,
    `${msg}${extra ? `\n${extra}` : ""}\nTrack: ${trackUrl}`
  ).catch(() => {});
}

export async function notifyDriverStatusPrompt(
  driverPhone: string,
  action: string
): Promise<void> {
  const prompts: Record<string, string> = {
    pickup_enroute: "📍 Headed to pickup? Reply ARRIVED when you get there.",
    picked_up:
      "📦 Got the items? Reply PICKED UP and send a photo of the cargo.",
    delivering: "🚗 On the way to dropoff. Reply DELIVERED when complete.",
  };

  const msg = prompts[action];
  if (msg) await sendSms(driverPhone, msg).catch(() => {});
}

export async function notifyClientNoMatch(
  clientPhone: string,
  orderNumber: string
): Promise<void> {
  await sendSms(
    clientPhone,
    `⏳ We're still working on finding a driver for order ${orderNumber}. ` +
      `We've expanded the search area. You'll get an update shortly.`
  ).catch(() => {});
}

export async function notifyAdminEscalation(
  order: DeliveryOrder
): Promise<void> {
  const adminPhone = process.env.ADMIN_PHONE;
  if (!adminPhone) return;

  await sendSms(
    adminPhone,
    `🚨 DISPATCH ESCALATION: Order ${order.orderNumber} unmatched after ${order.matchAttempts} attempts.\n` +
      `${order.pickupAddress} → ${order.dropoffAddress}\n` +
      `Client price: $${order.clientPrice.toFixed(2)}`
  ).catch(() => {});
}
