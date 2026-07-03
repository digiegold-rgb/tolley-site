import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { getAccessToken } from "@/lib/ebay/oauth";
import { ebayApiBase } from "@/lib/ebay/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function call(token: string, method: string, path: string, body?: unknown) {
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
  const result = {
    identity: await call(token, "GET", "/commerce/identity/v1/user/"),
    privilege: await call(token, "GET", "/sell/account/v1/privilege"),
    optedInPrograms: await call(token, "GET", "/sell/account/v1/program/get_opted_in_programs"),
    locations: await call(token, "GET", "/sell/inventory/v1/location"),
    feeSummary: await call(token, "GET", "/sell/account/v1/fee_summary?marketplace_id=EBAY_US&category_tree_id=0&category_id=11116"),
  };
  return NextResponse.json({ ok: true, result });
}
