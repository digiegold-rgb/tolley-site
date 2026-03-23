// @ts-nocheck — references removed Prisma models
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function getFoodHousehold() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  return household ? { ...household, userId: session.user.id } : null;
}

export async function requireFoodHousehold() {
  const household = await getFoodHousehold();
  if (!household) throw new Error("No household found");
  return household;
}
