import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getUserBillingState, isSubscribed } from "@/lib/billing-state";
import { parseAgentPayload } from "@/lib/agents";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const billingState = await getUserBillingState(userId);
  if (!isSubscribed(billingState)) {
    return NextResponse.json({ error: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  }

  const agents = await prisma.agent.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ agents });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const billingState = await getUserBillingState(userId);
  if (!isSubscribed(billingState)) {
    return NextResponse.json({ error: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { payload, errors } = parseAgentPayload(body);

    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const agent = await prisma.agent.create({
      data: {
        userId,
        name: payload.name,
        rolePurpose: payload.rolePurpose,
        modelProvider: payload.modelProvider,
        systemPrompt: payload.systemPrompt,
        toolsEnabled: payload.toolsEnabled,
        webhookUrl: payload.webhookUrl,
        phoneBinding: payload.phoneBinding,
        emailBinding: payload.emailBinding,
      },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error("create agent error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
