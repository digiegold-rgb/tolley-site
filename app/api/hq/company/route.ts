import { NextRequest } from "next/server";
import { z } from "zod";
import { validateWdAdmin } from "@/lib/wd-auth";
import { overview, controlCommand } from "@/lib/company/control";
import { body, endpoint, json } from "@/lib/company/auth";
import { CompanyError } from "@/lib/company/policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return endpoint(async () => { if (!(await validateWdAdmin()).authed) throw new CompanyError("unauthorized", 401); return json(await overview()); }); }
export async function POST(req: NextRequest) { return endpoint(async () => {
  if (!(await validateWdAdmin()).authed) throw new CompanyError("unauthorized", 401);
  if (req.headers.get("origin") !== req.nextUrl.origin) throw new CompanyError("origin_required", 403);
  const v = z.object({ command: z.enum(["PAUSE", "RESUME", "STOP", "ADMISSION", "APPROVE", "REJECT", "ROLLBACK"]), argument: z.string().max(150).default(""), requestId: z.string().min(8).max(100) }).strict().parse(await body(req));
  return json(await controlCommand(v.command, v.argument, `hq:${v.requestId}`));
}); }
