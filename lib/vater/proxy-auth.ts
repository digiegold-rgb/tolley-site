import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";

/**
 * Gate for the thin Vater → DGX autopilot proxy routes (voices, styles,
 * sfx-catalog, pipeline-status, reference-status). These were fully public,
 * which meant an unauthenticated write path to the DGX voice library. Studio
 * tier (not vater-admin) is the right bar — Trey's /animate UI polls them.
 * x-sync-secret is accepted for DGX/agent callers.
 */
export async function requireVaterProxyAuth(req: Request): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const sync = req.headers.get("x-sync-secret");
  if (sync && secretEquals(sync, process.env.SYNC_SECRET)) return { ok: true };

  const session = await auth();
  if (session?.user?.id && isVaterStudioEmail(session.user.email)) {
    return { ok: true };
  }
  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

/**
 * Read-only variant of the gate above.
 *
 * The write bar (studio tier) was also blocking READS, which broke the
 * public golden path: StyleWizardModal fetches /api/vater/voices and a
 * customer got 401, so they could never create a style — and therefore
 * never create a project. These catalogs (voices, styles, sfx, pipeline
 * status) are product metadata, not owner data, so any signed-in user may
 * read them. POST/PUT/DELETE still require requireVaterProxyAuth.
 */
export async function requireVaterProxyRead(req: Request): Promise<
  { ok: true } | { ok: false; response: NextResponse }
> {
  const sync = req.headers.get("x-sync-secret");
  if (sync && secretEquals(sync, process.env.SYNC_SECRET)) return { ok: true };

  const session = await auth();
  if (session?.user?.id) return { ok: true };

  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}
