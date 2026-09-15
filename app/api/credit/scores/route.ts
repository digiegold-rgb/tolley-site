import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { normalizeScorePost } from "@/lib/credit/sync";

const LEDGER_URL = process.env.LEDGER_URL || "http://localhost:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

export async function GET() {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const res = await fetch(`${LEDGER_URL}/credit/scores`, {
      headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Ledger unreachable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const body = await request.json();
    const payload = normalizeScorePost(
      body && typeof body === "object" && !Array.isArray(body) ? body : {}
    );
    const res = await fetch(`${LEDGER_URL}/credit/scores`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LEDGER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Ledger unreachable" }, { status: 502 });
  }
}
