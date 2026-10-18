import { NextRequest } from "next/server";
import { principal, body, endpoint, json } from "@/lib/company/auth";
import { createTask, taskView } from "@/lib/company/store";
export const runtime = "nodejs";
export async function POST(req: NextRequest) { return endpoint(async () => json(taskView(await createTask(await principal(req, "tasks:write"), req.headers.get("idempotency-key"), await body(req))), 202)); }
