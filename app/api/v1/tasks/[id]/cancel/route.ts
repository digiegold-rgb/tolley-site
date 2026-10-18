import { NextRequest } from "next/server";
import { principal, endpoint, json } from "@/lib/company/auth";
import { cancelTask } from "@/lib/company/store";
export const runtime = "nodejs";
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => json(await cancelTask(await principal(req, "tasks:write"), (await ctx.params).id))); }
