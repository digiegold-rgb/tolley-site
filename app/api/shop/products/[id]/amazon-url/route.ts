import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { revalidatePath } from "next/cache";
import { ASIN_NOT_FOUND_HINT, resolveAsinFromInput } from "@/lib/shop/amazon-asin";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const raw: string = (body?.url ?? "").toString();
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  // Short-link hosts (amzn.to, amzn.com, a.co/d/...) are resolved inside the helper.
  const { asin, resolvedFrom } = await resolveAsinFromInput(raw);

  if (!asin) {
    const detail = resolvedFrom
      ? ` (resolved to ${new URL(resolvedFrom).hostname})`
      : "";
    return NextResponse.json(
      {
        error: `Could not find an ASIN in that URL${detail}. ${ASIN_NOT_FOUND_HINT}`,
        resolvedFrom,
      },
      { status: 422 }
    );
  }

  const product = await prisma.product.update({
    where: { id },
    data: { amazonAsin: asin },
    select: { id: true, amazonAsin: true },
  });

  revalidatePath("/shop");
  return NextResponse.json({ ok: true, asin: product.amazonAsin });
}
