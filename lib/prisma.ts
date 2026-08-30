import { PrismaClient } from "@prisma/client";
import { databaseUrlWithTimeouts } from "@/lib/prisma-url";

declare global {
  var prisma: PrismaClient | undefined;
}

const databaseUrl = databaseUrlWithTimeouts(process.env.DATABASE_URL);

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
