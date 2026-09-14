import { NextResponse } from "next/server";
import { requireGenerateAdmin } from "@/lib/generate-auth";
import { isModalConfigured } from "@/lib/generate-modal";
import { isFalConfigured } from "@/lib/generate-motion-card";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const access = await requireGenerateAdmin();
    if (!access.ok) return access.response;
    return NextResponse.json({ authenticated: true, modal: { configured: isModalConfigured() }, fal: { configured: isFalConfigured() } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "SERVICE_UNAVAILABLE", error: "The sign-in service could not be checked. Your form is still here; try again." }, { status: 503 });
  }
}
