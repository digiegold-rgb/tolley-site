import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { postToAgent } from "@/lib/agent-proxy";

type MemoryGetPayload = {
  conversationId?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as MemoryGetPayload;
    const upstream = await postToAgent("/memory/get", {
      userId,
      conversationId: payload.conversationId,
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
    console.error("Memory get proxy error:", error);
    return NextResponse.json({ error: "Memory service unavailable" }, { status: 503 });
  }
}
