import { NextRequest } from "next/server";
import { principal, body, endpoint, json } from "@/lib/company/auth";
import { makeQuote } from "@/lib/company/store";
export const runtime = "nodejs";
export async function POST(req: NextRequest) { return endpoint(async () => json(await makeQuote(await principal(req, "tasks:write"), await body(req)), 201)); }
