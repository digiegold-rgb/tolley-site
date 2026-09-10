import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cache } from "react";
import { redirect } from "next/navigation";
export const requireLeadSubscriber = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fleads");
  const sub = await prisma.leadSubscriber.findUnique({ where: { userId: session.user.id } });
  if (!sub || sub.status !== "active") redirect("/leads/pricing");
  return sub;
});
