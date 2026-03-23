import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const LEDGER_URL = process.env.LEDGER_URL || "http://localhost:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

export async function GET() {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const res = await fetch(`${LEDGER_URL}/credit/recommendations`, {
      headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Ledger unreachable" }, { status: 502 });
  }
}

export async function POST() {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const res = await fetch(`${LEDGER_URL}/credit/recommendations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
      signal: AbortSignal.timeout(65000),
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "Recommendations generation failed" },
      { status: 502 }
    );
  }
}
