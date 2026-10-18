import { NextRequest } from "next/server";
import { principal, endpoint, json } from "@/lib/company/auth";
import { getTask } from "@/lib/company/store";
export const runtime = "nodejs";
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) { return endpoint(async () => json(await getTask(await principal(req, "tasks:read"), (await ctx.params).id))); }
