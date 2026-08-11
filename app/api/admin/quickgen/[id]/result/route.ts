import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

// Streams the finished PNG/MP4 back through the admin gate.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const r = await fetch(`https://quickgen.tolley.io/job/${encodeURIComponent(id)}/result`, {
    headers: { "x-api-key": process.env.QUICKGEN_API_KEY || "" },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ error: "not ready" }, { status: r.status });
  return new NextResponse(r.body, {
    headers: {
      "Content-Type": r.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "no-store",
    },
  });
}
