import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

// body: { ref_ids: "id1,id2" } — images already uploaded via the ticket flow
export async function POST(req: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ref_ids } = await req.json();
  const r = await fetch(`https://quickgen.tolley.io/persona/ref?ref_ids=${encodeURIComponent(ref_ids || "")}`, {
    method: "POST", headers: { "x-api-key": process.env.QUICKGEN_API_KEY || "" },
  });
  const text = await r.text();
  try { return NextResponse.json(JSON.parse(text), { status: r.status }); }
  catch { return NextResponse.json({ error: `upstream ${r.status}: ${text.slice(0, 300)}` }, { status: 502 }); }
}
