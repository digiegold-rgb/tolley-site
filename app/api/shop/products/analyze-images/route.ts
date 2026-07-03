import { NextRequest, NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { analyzeProductImages } from "@/lib/shop/ai-vision-product";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { imageUrls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrls = Array.isArray(body.imageUrls)
    ? (body.imageUrls.filter((x) => typeof x === "string") as string[])
    : [];

  if (imageUrls.length === 0) {
    return NextResponse.json(
      { error: "imageUrls must be a non-empty array of strings" },
      { status: 400 }
    );
  }

  const started = Date.now();
  try {
    const result = await analyzeProductImages(imageUrls);
    return NextResponse.json({
      result,
      elapsedMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[shop/analyze-images] failed:", message);
    const isTimeout = message.includes("timeout") || message.includes("aborted");
    return NextResponse.json(
      { error: "Vision analysis failed", detail: message },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
