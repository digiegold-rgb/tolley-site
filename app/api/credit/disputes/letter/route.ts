import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const LEDGER_URL = process.env.LEDGER_URL || "http://localhost:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const body = await req.json();
    const res = await fetch(`${LEDGER_URL}/credit/disputes/letter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LEDGER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000),
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "Ledger unreachable or letter generation timed out" },
      { status: 502 }
    );
  }
}
