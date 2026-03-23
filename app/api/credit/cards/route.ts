import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const LEDGER_URL = process.env.LEDGER_URL || "http://localhost:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

export async function GET() {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const res = await fetch(`${LEDGER_URL}/credit/cards`, {
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
    const { accountId, ...meta } = body;
    const res = await fetch(
      `${LEDGER_URL}/credit/cards/${accountId}/meta`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LEDGER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(meta),
        signal: AbortSignal.timeout(10000),
      }
    );
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Ledger unreachable" }, { status: 502 });
  }
}
