import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { critiqueGeneration } from "@/lib/vision-critique";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { imageUrl, originalPrompt, type } = body as {
    imageUrl?: string;
    originalPrompt?: string;
    type?: "image" | "video";
  };

  if (!imageUrl || !originalPrompt) {
    return NextResponse.json(
      { error: "imageUrl and originalPrompt required" },
      { status: 400 },
    );
  }

  try {
    const result = await critiqueGeneration(
      imageUrl,
      originalPrompt,
      type || "image",
    );
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Critique failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
