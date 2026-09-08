import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FsboFinder from "@/components/leads/FsboFinder";

export const revalidate = 0;

export default async function FsboPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/fsbo");

  let fsboLeads: any[] = [];
  try {
    fsboLeads = await prisma.lead.findMany({
      where: { source: { contains: "fsbo" } },
      include: { listing: { select: { address: true, city: true, zip: true, listPrice: true, beds: true, baths: true, sqft: true, photoUrls: true, daysOnMarket: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch { /* handle gracefully */ }

  const serialized = fsboLeads.map((l: any) => ({
    ...l,
    createdAt: l.createdAt?.toISOString?.() ?? l.createdAt,
    updatedAt: l.updatedAt?.toISOString?.() ?? l.updatedAt,
    contactedAt: l.contactedAt?.toISOString?.() ?? null,
    closedAt: l.closedAt?.toISOString?.() ?? null,
  }));

  return <FsboFinder leads={serialized} />;
}
