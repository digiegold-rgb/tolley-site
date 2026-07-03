import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

const BodySchema = z.object({
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

  const batchId = genId("batch");
  const rows = parsed.groups.map((g) => ({
    id: genId("bij"),
    batchId,
    photoUrls: g.photoUrls,
  }));

  await prisma.bulkIngestJob.createMany({ data: rows });

  return NextResponse.json({
    batchId,
    jobIds: rows.map((r) => r.id),
    count: rows.length,
  });
}
