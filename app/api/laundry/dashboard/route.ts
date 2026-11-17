import { prisma } from "@/lib/prisma";
import { actor } from "@/lib/laundry/auth";
import { handle } from "@/lib/laundry/http";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    const who = await actor();
    const operators = await prisma.laundryOperator.findMany({
      where: who.admin ? {} : { ownerId: who.id },
      orderBy: { createdAt: "desc" },
    });
    const leads = await prisma.laundryLead.findMany({
      where: who.admin
        ? {}
        : { operatorId: { in: operators.map((o) => o.id) } },
      include: {
        booking: true,
        review: true,
        operator: { select: { name: true, feeCents: true } },
        events: { orderBy: { createdAt: "desc" }, take: 10 },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const messages = await prisma.laundryMessage.findMany({
      where: { leadId: { in: leads.map((l) => l.id) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const cities = who.admin
      ? await prisma.$queryRaw<
          Array<{
            city: string;
            state: string;
            leads: bigint;
            bookings: bigint;
            collected: number;
            refunded: number;
          }>
        >`SELECT l."city",l."state",COUNT(*) AS leads, COUNT(b."id") AS bookings, COALESCE(SUM(CASE WHEN b."paidAt" IS NOT NULL THEN b."feeCents" ELSE 0 END),0)::int AS collected, COALESCE(SUM(b."refundedCents"),0)::int AS refunded FROM "LaundryLead" l LEFT JOIN "LaundryBooking" b ON b."leadId"=l."id" GROUP BY l."city",l."state" ORDER BY COUNT(*) DESC`
      : [];
    const notifications = who.admin
      ? await prisma.laundryNotification.groupBy({
          by: ["status"],
          _count: true,
        })
      : [];
    return {
      admin: who.admin,
      operators,
      leads,
      messages,
      cities: cities.map((c) => ({
        ...c,
        leads: Number(c.leads),
        bookings: Number(c.bookings),
      })),
      notifications,
      billingEnabled: process.env.LAUNDRY_BILLING_ENABLED === "true",
      notificationsEnabled:
        process.env.LAUNDRY_NOTIFICATIONS_ENABLED === "true",
    };
  });
}
