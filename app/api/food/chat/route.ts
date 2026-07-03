// Food API route
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { chatText, type ChatTextMessage } from "@/lib/food/ai-client";

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

  const messages: ChatTextMessage[] = [
    { role: "system", content: systemPrompt },
    ...((history || []).slice(-6) as ChatTextMessage[]),
    { role: "user", content: message },
  ];

  try {
    const reply = await chatText({
      task: "food-chat",
      messages,
      temperature: 0.7,
      maxTokens: 1000,
    });
    return NextResponse.json({
      reply: reply || "Sorry, I couldn't think of a response!",
    });
  } catch (err) {
    console.error("[food-chat] failed", err);
    return NextResponse.json({
      reply: "I'm having trouble connecting right now. Try again in a moment!",
    });
  }
}
