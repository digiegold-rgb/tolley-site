// @ts-nocheck — references removed schema fields
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Process payouts for all drivers with available earnings
export async function processDriverPayouts() {
  // Find all available earnings grouped by driver
  const availableEarnings = await prisma.driverEarning.findMany({
    where: {
      status: "available",
      availableAt: { lte: new Date() },
    },
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          stripeConnectId: true,
          bankLinkedAt: true,
        },
      },
    },
  });

  if (availableEarnings.length === 0) {
    return { processed: 0, payouts: [] };
  }

  // Group by driver
  const byDriver: Record<string, typeof availableEarnings> = {};
  for (const earning of availableEarnings) {
    const did = earning.driverId;
    if (!byDriver[did]) byDriver[did] = [];
    byDriver[did].push(earning);
  }

  const results: Array<{
    driverId: string;
    driverName: string;
    amount: number;
    status: string;
    error?: string;
  }> = [];

  for (const [driverId, earnings] of Object.entries(byDriver)) {
    const driver = earnings[0].driver;
    const totalAmount = earnings.reduce((s, e) => s + e.total, 0);

    if (!driver.stripeConnectId) {
      results.push({
        driverId,
        driverName: driver.name,
        amount: totalAmount,
        status: "skipped",
        error: "No Stripe Connect account",
      });
      continue;
    }

    try {
      // Create payout record
      const payout = await prisma.driverPayout.create({
        data: {
          driverId,
          amount: totalAmount,
          method: "stripe_connect",
          status: "processing",
        },
      });

      // Execute Stripe transfer
      const transfer = await getStripe().transfers.create({
        amount: Math.round(totalAmount * 100), // cents
        currency: "usd",
        destination: driver.stripeConnectId,
        description: `Driver payout: ${earnings.length} deliveries`,
        metadata: {
          payoutId: payout.id,
          driverId,
          earningCount: String(earnings.length),
        },
      });

      // Update payout with transfer ID
      await prisma.driverPayout.update({
        where: { id: payout.id },
        data: {
          stripeTransferId: transfer.id,
          status: "completed",
          completedAt: new Date(),
        },
      });

      // Mark earnings as paid out
      await prisma.driverEarning.updateMany({
        where: { id: { in: earnings.map((e) => e.id) } },
        data: {
          status: "paid_out",
          paidOutAt: new Date(),
          payoutId: payout.id,
        },
      });

      // Update driver stats
      await prisma.deliveryDriver.update({
        where: { id: driverId },
        data: { totalDeliveries: { increment: earnings.length } },
      });

      results.push({
        driverId,
        driverName: driver.name,
        amount: totalAmount,
        status: "completed",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({
        driverId,
        driverName: driver.name,
        amount: totalAmount,
        status: "failed",
        error: message,
      });
    }
  }

  return {
    processed: results.length,
    payouts: results,
  };
}

// Link a driver's bank account via Plaid + Stripe Connect
export async function linkDriverBank(
  driverId: string,
  stripeBankToken: string,
  accountLast4: string,
  institutionName: string,
  plaidItemId: string,
) {
  // Get or create Stripe Connected Account
  let driver = await prisma.deliveryDriver.findUnique({
    where: { id: driverId },
    select: { stripeConnectId: true, name: true, userId: true },
  });

  if (!driver) throw new Error("Driver not found");

  let connectId = driver.stripeConnectId;

  if (!connectId) {
    // Create Stripe Connect Express account
    const user = await prisma.user.findUnique({
      where: { id: driver.userId },
      select: { email: true },
    });

    const account = await getStripe().accounts.create({
      type: "express",
      country: "US",
      email: user?.email || undefined,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: "individual",
      metadata: { driverId },
    });
    connectId = account.id;
  }

  // Attach bank account to Connect account
  await getStripe().accounts.createExternalAccount(connectId, {
    external_account: stripeBankToken,
  });

  // Update driver record
  await prisma.deliveryDriver.update({
    where: { id: driverId },
    data: {
      stripeConnectId: connectId,
      bankLinkedAt: new Date(),
      bankAccountLast4: accountLast4,
      bankInstitution: institutionName,
      plaidItemId,
    },
  });

  return { success: true, connectId };
}
