import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { getAccessToken } from "@/lib/ebay/oauth";
import { ebayApiBase } from "@/lib/ebay/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROGRAM = "SELLING_POLICY_MANAGEMENT";

async function call(token: string, method: "GET" | "POST", path: string, body?: unknown) {
  const r = await fetch(`${ebayApiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

export async function GET() {
  if (!(await validateShopAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await getAccessToken();
  const opted = await call(token, "GET", "/sell/account/v1/program/get_opted_in_programs");
  return NextResponse.json({ ok: true, opted });
}

export async function POST() {
  if (!(await validateShopAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await getAccessToken();
  const optIn = await call(token, "POST", "/sell/account/v1/program/opt_in", { programType: PROGRAM });
  const opted = await call(token, "GET", "/sell/account/v1/program/get_opted_in_programs");
  return NextResponse.json({ ok: optIn.status === 200 || optIn.status === 204, optIn, opted });
}
