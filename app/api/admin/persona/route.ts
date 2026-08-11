import { NextRequest, NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

const BASE = "https://quickgen.tolley.io";
const KEY = () => process.env.QUICKGEN_API_KEY || "";

async function pass(r: Response) {
  const text = await r.text();
  try { return NextResponse.json(JSON.parse(text), { status: r.status }); }
  catch { return NextResponse.json({ error: `upstream ${r.status}: ${text.slice(0, 300)}` }, { status: 502 }); }
}

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return pass(await fetch(`${BASE}/persona`, { headers: { "x-api-key": KEY() }, cache: "no-store" }));
}

export async function POST(req: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return pass(await fetch(`${BASE}/persona`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-api-key": KEY() },
    body: JSON.stringify(await req.json()),
  }));
}
