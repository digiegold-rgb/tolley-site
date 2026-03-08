import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { postToAgent } from "@/lib/agent-proxy";

type MemoryForgetPayload = {
  conversationId?: string;
  key?: string;
  index?: number;
  clearSession?: boolean;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as MemoryForgetPayload;

    if (!payload.key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const upstream = await postToAgent("/memory/forget", {
      userId,
      conversationId: payload.conversationId,
      key: payload.key,
      index: payload.index,
      clearSession: payload.clearSession,
    });

    const data = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Memory service unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Memory forget proxy error:", error);
    return NextResponse.json({ error: "Memory service unavailable" }, { status: 503 });
  }
}
