// Food API route — scan a physical recipe (photo of cookbook page, index card,
// magazine, printout, or screenshot) and return parsed recipe JSON.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { put } from "@vercel/blob";
import { scanRecipe } from "@/lib/food/ai-recipe-scan";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
  });
  if (!household)
    return NextResponse.json({ error: "No household" }, { status: 404 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ error: "file is required" }, { status: 400 });

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );

    if (file.size > MAX_SIZE)
      return NextResponse.json(
        { error: "File too large (10MB max)" },
        { status: 400 }
      );

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const parsed = await scanRecipe(base64, file.type);

    if (!parsed.title || !parsed.ingredients?.length || !parsed.instructions?.length) {
      return NextResponse.json(
        { error: "Couldn't read a recipe from that image. Try a clearer photo with the full recipe visible." },
        { status: 422 }
      );
    }

    // Store the source photo so the saved recipe can reference it as imageUrl.
    const blob = await put(
      `food/recipes/scanned/${household.id}/${Date.now()}-${file.name}`,
      file,
      { access: "public" }
    );

    return NextResponse.json({ parsed, imageUrl: blob.url }, { status: 200 });
  } catch (err) {
    console.error("[Food] Recipe scan error:", err);
    return NextResponse.json(
      { error: "Failed to scan recipe" },
      { status: 500 }
    );
  }
}
