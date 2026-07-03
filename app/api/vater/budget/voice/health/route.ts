import { NextResponse } from "next/server";
import { checkVoiceBearer } from "@/lib/budget/voice-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = checkVoiceBearer(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    spoken: "Budget voice endpoint is reachable.",
    ts: new Date().toISOString(),
  });
}
