import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateWdAdmin } from "@/lib/wd-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Route handlers do not inherit the owner check in the enclosing layout.
  if (!(await validateWdAdmin()).authed) {
    return new Response("Owner login required", { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }
  const script = await readFile(path.join(process.cwd(), "ops/stream/mac-mini-hub/Tolley-Mac-Mini-Setup.command"), "utf8");
  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="Tolley-Mac-Mini-Setup.command"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
