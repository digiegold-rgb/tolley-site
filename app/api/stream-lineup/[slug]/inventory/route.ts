import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
import { reserveShow } from "@/lib/shop/show-inventory";
import { InventoryError } from "@/lib/shop/inventory";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!["reserve", "release"].includes(body?.action)) return NextResponse.json({ error: "Choose reserve or release" }, { status: 400 });
  try {
    const result = await reserveShow(slug, body.action === "release");
    revalidatePath("/shop");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof InventoryError ? e.message : "Could not update show reservations" }, { status: e instanceof InventoryError ? e.status : 500 });
  }
}
