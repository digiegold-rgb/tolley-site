// @ts-nocheck — references removed Prisma models
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VLLM_URL = process.env.VLLM_URL || "http://127.0.0.1:8355/v1";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: session.user.id },
    include: { members: true },
  });

  const { message, history } = await request.json();
  if (!message) return NextResponse.json({ error: "No message" }, { status: 400 });

  // Build context about the household
  const pantryItems = household
    ? await prisma.foodPantryItem.findMany({
        where: { householdId: household.id, status: { not: "out_of_stock" } },
        take: 30,
      })
    : [];

  const recentRecipes = household
    ? await prisma.foodRecipe.findMany({
        where: { householdId: household.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { title: true, cuisine: true, tags: true, rating: true },
      })
    : [];

  const dietaryInfo = household?.members
    ?.map((m) => `${m.name} (${m.role}): ${m.dietaryFlags.join(", ") || "none"}`)
    .join("; ") || "No family members set up";

  const pantryList = pantryItems.map((p) => p.name).join(", ") || "Empty pantry";

  const systemPrompt = `You are Ruthann's Kitchen Assistant — a friendly, helpful AI that knows everything about cooking, meal planning, grocery shopping, and nutrition. You speak in a warm, encouraging tone.

Context about the household:
- Family dietary needs: ${dietaryInfo}
- In the pantry right now: ${pantryList}
- Recent recipes: ${recentRecipes.map((r) => r.title).join(", ") || "none yet"}

You can help with:
- Recipe suggestions and modifications
- Cooking tips and substitutions
- Meal planning advice
- Grocery shopping tips
- Nutrition questions
- "What can I make with..." questions

Keep responses concise and practical. Use emojis sparingly.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(history || []).slice(-6),
    { role: "user", content: message },
  ];

  try {
    const res = await fetch(`${VLLM_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "Qwen/Qwen3.5-35B-A3B-FP8",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) return NextResponse.json({ error: "AI unavailable" }, { status: 502 });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't think of a response!";
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ reply: "I'm having trouble connecting right now. Try again in a moment!" });
  }
}
