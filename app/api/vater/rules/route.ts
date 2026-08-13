import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterStudioEmail } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves data/VATER-RULES.pdf (compiled from ~/vater-studio/VATER-RULES.md on the
// DGX) to studio-allowlisted users only. Traced into the serverless bundle via
// outputFileTracingIncludes in next.config.ts.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let bytes: Buffer;
  try {
    bytes = await fs.readFile(path.join(process.cwd(), "data", "VATER-RULES.pdf"));
  } catch {
    return NextResponse.json({ error: "Rules PDF not found" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": download
        ? 'attachment; filename="VATER-RULES.pdf"'
        : "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
