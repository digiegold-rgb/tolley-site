import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  fetchSearchConsoleSummary,
  searchConsoleServiceAccountEmail,
} from "@/lib/search-console";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("days") ?? "28", 10) || 28, 1),
    90,
  );

  const summary = await fetchSearchConsoleSummary(days);
  return NextResponse.json({
    ...summary,
    serviceAccountEmail: searchConsoleServiceAccountEmail(),
  });
}
