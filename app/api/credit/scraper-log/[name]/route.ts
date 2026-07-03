import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const LEDGER_URL = process.env.LEDGER_URL || "http://localhost:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { name } = await params;
  const safe = String(name).replace(/[^a-z0-9_-]/gi, "");
  if (!safe) {
    return NextResponse.json({ error: "invalid name" }, { status: 400 });
  }

  try {
    const res = await fetch(`${LEDGER_URL}/credit/scraper-logs/${safe}`, {
      headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Ledger unreachable" }, { status: 502 });
  }
}
