import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

const BodySchema = z.object({
  // Client-generated batch id makes resubmits idempotent: if the response to a
  // successful POST is lost (flaky wifi), the retry reuses the same id and the
  // server returns the existing batch instead of creating a duplicate.
  batchId: z
    .string()
    .regex(/^batch_[A-Za-z0-9_-]{16,64}$/)
    .optional(),
  groups: z
    .array(
      z.object({
        photoUrls: z
          .array(z.string().url().refine((u) => /\.public\.blob\.vercel-storage\.com|blob\.vercel-storage\.com/.test(u), {
            message: "must be a Vercel Blob URL",
          }))
          .min(1)
          .max(10),
      })
    )
    .min(1)
    .max(30),
});

function genId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

export async function POST(request: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid body", detail: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  const batchId = parsed.batchId ?? genId("batch");

  if (parsed.batchId) {
    const existing = await prisma.bulkIngestJob.findMany({
      where: { batchId },
      select: { id: true },
    });
    if (existing.length > 0) {
      return NextResponse.json({
        batchId,
        jobIds: existing.map((r) => r.id),
        count: existing.length,
        deduped: true,
      });
    }
  }

  const rows = parsed.groups.map((g, i) => ({
    id: genId("bij"),
    batchId,
    idx: i,
    photoUrls: g.photoUrls,
  }));

  // skipDuplicates + @@unique([batchId, idx]) makes even a concurrent
  // double-POST race safe — the second insert no-ops per row.
  await prisma.bulkIngestJob.createMany({ data: rows, skipDuplicates: true });

  return NextResponse.json({
    batchId,
    jobIds: rows.map((r) => r.id),
    count: rows.length,
  });
}
