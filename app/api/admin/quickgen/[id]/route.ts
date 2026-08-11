import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await fetch(`https://quickgen.tolley.io/job/${encodeURIComponent(id)}`, {
    headers: { "x-api-key": process.env.QUICKGEN_API_KEY || "" },
    cache: "no-store",
  });
  return NextResponse.json(await r.json(), { status: r.status });
}
