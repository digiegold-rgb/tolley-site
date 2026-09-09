import type { Prisma } from "@prisma/client";

export const SHOP_VIDEO_WHERE = {
  videoUrl: { not: null },
  NOT: { videoUrl: "" },
  status: { in: ["listed", "sold"] },
} satisfies Prisma.ProductWhereInput;
