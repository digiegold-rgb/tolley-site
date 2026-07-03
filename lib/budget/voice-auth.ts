import { NextResponse } from "next/server";

export function checkVoiceBearer(req: Request):
  | { ok: true }
  | { ok: false; response: NextResponse } {
  const expected = process.env.VATER_BUDGET_VOICE_KEY;
  if (!expected || expected.length < 24) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "VOICE_KEY_NOT_CONFIGURED" },
        { status: 503 },
      ),
    };
  }
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided || provided !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }
  return { ok: true };
}
