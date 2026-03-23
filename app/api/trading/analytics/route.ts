import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BRIDGE_URL =
  process.env.OPENCLAW_CHAT_BRIDGE_URL || "https://chat-bridge.tolley.io";
const BRIDGE_TOKEN = process.env.OPENCLAW_CHAT_BRIDGE_TOKEN || "";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "snapshot"; // "snapshot" or "report"

  const endpoint = mode === "report" ? "/report" : "/snapshot";

  try {
    const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${BRIDGE_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Trading bridge unavailable", detail: String(error) },
      { status: 503 },
    );
  }
}
