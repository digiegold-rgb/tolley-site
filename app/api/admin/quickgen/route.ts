import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

const BASE = "https://quickgen.tolley.io";

// POST /api/admin/quickgen — submit a prompt→image/video job to the DGX.
export async function POST(req: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const r = await fetch(`${BASE}/gen`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.QUICKGEN_API_KEY || "",
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await r.json(), { status: r.status });
}
