import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const BRIDGE_URL =
  process.env.OPENCLAW_CHAT_BRIDGE_URL || "https://chat-bridge.tolley.io";
const BRIDGE_TOKEN = process.env.OPENCLAW_CHAT_BRIDGE_TOKEN || "";

export async function POST(request: Request) {
  const sessionResult = await requireAdminApiSession();
  if (!sessionResult.ok) return sessionResult.response;

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  if (message.length > 4000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  if (!BRIDGE_TOKEN) {
    return NextResponse.json(
      { error: "Chat bridge not configured" },
      { status: 503 },
    );
  }

  try {
    const res = await fetch(`${BRIDGE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BRIDGE_TOKEN}`,
      },
      body: JSON.stringify({ message, agentId: "crypto-oracle" }),
      signal: AbortSignal.timeout(100_000),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || "Bridge error", detail: data.detail },
        { status: res.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[trading/chat] bridge error:", error);
    return NextResponse.json(
      { error: "Agent unavailable", detail: String(error) },
      { status: 503 },
    );
  }
}
