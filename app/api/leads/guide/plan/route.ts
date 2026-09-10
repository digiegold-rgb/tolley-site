import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-auth";
import { PERSONAL_USE_PLAN_FILENAME, readPersonalUsePlan } from "@/lib/leads/personal-use-plan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: privateHeaders });
  if (session.mfaRequired || !isAdminEmail(session.user.email)) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403, headers: privateHeaders });
  }
  try {
    return new Response(await readPersonalUsePlan(), {
      headers: {
        ...privateHeaders,
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${PERSONAL_USE_PLAN_FILENAME}"`,
      },
    });
  } catch {
    return Response.json({ error: "The plan could not be loaded. Please try again." }, { status: 503, headers: privateHeaders });
  }
}
