import { PrismaClient } from "@prisma/client";
import { databaseUrlWithTimeouts, resolveWritableDatabaseUrl } from "@/lib/prisma-url";

declare global {
  var prisma: PrismaClient | undefined;
}

const databaseUrl = databaseUrlWithTimeouts(resolveWritableDatabaseUrl(process.env));

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
