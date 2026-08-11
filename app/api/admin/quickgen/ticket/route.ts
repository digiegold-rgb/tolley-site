import { NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";

// Mints a one-time upload ticket so the browser can POST large files straight
// to quickgen.tolley.io (Vercel body limits) without ever seeing the API key.
export async function POST() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await fetch("https://quickgen.tolley.io/ticket", {
    method: "POST",
    headers: { "x-api-key": process.env.QUICKGEN_API_KEY || "" },
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
