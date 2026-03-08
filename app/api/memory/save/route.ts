import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { postToAgent } from "@/lib/agent-proxy";
import type { ListingCard } from "@/types/chat";

type MemorySavePayload = {
  conversationId?: string;
  listing?: ListingCard;
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as MemorySavePayload;
    const listing = payload.listing;

    if (!listing || typeof listing.address !== "string" || !listing.address.trim()) {
      return NextResponse.json({ error: "listing is required" }, { status: 400 });
    }

    const upstream = await postToAgent("/memory/update", {
      userId,
      conversationId: payload.conversationId,
      key: "savedListings",
      value: listing,
      mode: "append",
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
    console.error("Memory save proxy error:", error);
    return NextResponse.json({ error: "Memory service unavailable" }, { status: 503 });
  }
}
