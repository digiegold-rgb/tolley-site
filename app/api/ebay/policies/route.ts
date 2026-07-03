import { NextResponse } from "next/server";
import { validateShopAdmin } from "@/lib/shop-auth";
import { getAccessToken } from "@/lib/ebay/oauth";
import { ebayApiBase } from "@/lib/ebay/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLICY_KINDS = [
  { path: "payment_policy", listKey: "paymentPolicies", idKey: "paymentPolicyId" },
  { path: "return_policy", listKey: "returnPolicies", idKey: "returnPolicyId" },
  { path: "fulfillment_policy", listKey: "fulfillmentPolicies", idKey: "fulfillmentPolicyId" },
] as const;

export async function GET() {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let token: string;
  try {
    token = await getAccessToken();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "no access token" },
      { status: 503 }
    );
  }

  const base = ebayApiBase();
  const summary: Record<string, unknown> = {};

  for (const { path, listKey, idKey } of POLICY_KINDS) {
    const r = await fetch(`${base}/sell/account/v1/${path}?marketplace_id=EBAY_US`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    const list = (j as Record<string, unknown[]>)[listKey];
    summary[path] = {
      httpStatus: r.status,
      total: Array.isArray(list) ? list.length : 0,
      items: Array.isArray(list)
        ? list.map((po) => {
            const obj = po as Record<string, unknown>;
            return {
              id: obj[idKey],
              name: obj.name,
              description: typeof obj.description === "string" ? obj.description.slice(0, 100) : null,
            };
          })
        : null,
      error: !Array.isArray(list) ? j : undefined,
    };
  }

  return NextResponse.json({ ok: true, policies: summary });
}
