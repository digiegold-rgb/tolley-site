import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const ENGINE_URL = process.env.CRYPTO_ENGINE_URL || "http://localhost:8950";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const body = await request.json();
    const { mode } = body;

    if (!mode || !["paper", "live"].includes(mode)) {
      return NextResponse.json(
        { error: "Mode must be 'paper' or 'live'" },
        { status: 400 }
      );
    }

    const res = await fetch(`${ENGINE_URL}/mode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET,
      },
      body: JSON.stringify({ mode }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to communicate with engine" },
      { status: 502 }
    );
  }
}
