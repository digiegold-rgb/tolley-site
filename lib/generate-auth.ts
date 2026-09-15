/**
 * Jared / admin gate for /generate Modal jobs.
 *
 * Owner account session with completed MFA. Legacy PIN cookies grant no access.
 * Existing owner actor IDs are retained for saved queues.
 *
 * Modal tokens never leave the server. Webhook uses a separate shared secret.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isVaterAdminEmail, isVaterOwnerUser } from "@/lib/admin-auth";

export {
  generateWebhookSecret,
  resolveGenerateActor,
  signGenerateWebhook,
  verifyGenerateWebhook,
} from "@/lib/generate-auth-core";

export type GenerateActor = {
  createdBy: string;
};

export async function requireGenerateAdmin(destination: "/generate" | "/gen2" = "/generate"): Promise<
  | { ok: true; createdBy: string }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(destination)}`;
  if (session?.mfaRequired) return { ok: false, response: NextResponse.json({
    error: "Complete two-factor authentication to use Generate.", code: "MFA_REQUIRED",
    loginUrl: `/login/mfa-challenge?callbackUrl=${encodeURIComponent(destination)}`,
  }, { status: 403 }) };
  if (!session?.user?.id) return { ok: false, response: NextResponse.json({
    error: "Sign in with your owner account to use Generate.", code: "LOGIN_REQUIRED", loginUrl,
  }, { status: 401 }) };
  if (session.impersonatedBy || !await isVaterOwnerUser(session.user.id, session.user.email)) {
    return { ok: false, response: NextResponse.json({
      error: session.impersonatedBy ? "Exit view-as-user mode to generate." : "This account does not have owner access to Generate.",
      code: "FORBIDDEN", loginUrl,
    }, { status: 403 }) };
  }
  // Preserve the existing owner's queue/library actor instead of orphaning saved work.
  return { ok: true, createdBy: isVaterAdminEmail(session.user.email) ? "hq:tolley" : (session.user.email || session.user.id).trim().toLowerCase() };
}
