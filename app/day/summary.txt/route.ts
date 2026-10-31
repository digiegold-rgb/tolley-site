import { hasValidShopAdminCookie } from "@/lib/shop-auth";
import { hasBearer, privateHeaders } from "@/lib/day/auth";
import { summaryText } from "@/lib/day/core";
import { readSnapshot } from "@/lib/day/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { ...privateHeaders, "Content-Type": "text/plain; charset=utf-8" };
  if (!hasBearer(request, process.env.DAY_SUMMARY_TOKEN) && !await hasValidShopAdminCookie()) {
    return new Response("PIN session or summary bearer token required.\n", { status: 401, headers });
  }
  const result = await readSnapshot();
  return new Response(summaryText(result.snapshot), { status: result.storage === "ready" && result.snapshot ? 200 : 503, headers });
}
