import { NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await fetch("https://quickgen.tolley.io/dgx-status", {
    headers: { "x-api-key": process.env.QUICKGEN_API_KEY || "" },
    cache: "no-store",
  });
  const text = await r.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: r.status });
  } catch {
    return NextResponse.json(
      { error: `upstream ${r.status}: ${text.slice(0, 300)}` },
      { status: 502 },
    );
  }
}
