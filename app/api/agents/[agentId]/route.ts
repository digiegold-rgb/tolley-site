import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getUserBillingState, isSubscribed } from "@/lib/billing-state";
import { parseAgentPayload } from "@/lib/agents";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const billingState = await getUserBillingState(userId);
  if (!isSubscribed(billingState)) {
    return NextResponse.json({ error: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  }

  const { agentId } = await context.params;
  if (!agentId) {
    return NextResponse.json({ error: "Agent id is required." }, { status: 400 });
  }

  const existing = await prisma.agent.findFirst({
    where: {
      id: agentId,
      userId,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mergedInput = {
      ...existing,
      ...body,
    };
    const { payload, errors } = parseAgentPayload(mergedInput);

    if (errors.length) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const updated = await prisma.agent.update({
      where: { id: agentId },
      data: {
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

    return NextResponse.json({ agent: updated });
  } catch (error) {
    console.error("update agent error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const billingState = await getUserBillingState(userId);
  if (!isSubscribed(billingState)) {
    return NextResponse.json({ error: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  }

  const { agentId } = await context.params;
  if (!agentId) {
    return NextResponse.json({ error: "Agent id is required." }, { status: 400 });
  }

  const deleted = await prisma.agent.deleteMany({
    where: {
      id: agentId,
      userId,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
