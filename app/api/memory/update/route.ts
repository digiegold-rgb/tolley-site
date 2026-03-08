import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { postToAgent } from "@/lib/agent-proxy";

type MemoryUpdatePayload = {
  conversationId?: string;
  key?: string;
  value?: unknown;
  mode?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as MemoryUpdatePayload;

    if (!payload.key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }

    const upstream = await postToAgent("/memory/update", {
      userId,
      conversationId: payload.conversationId,
      key: payload.key,
      value: payload.value,
      mode: payload.mode,
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
    console.error("Memory update proxy error:", error);
    return NextResponse.json({ error: "Memory service unavailable" }, { status: 503 });
  }
}
