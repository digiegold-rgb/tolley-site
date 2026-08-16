/**
 * /api/admin/vater/view-as — start / stop an admin "view as user" session.
 *
 *   POST   { userId } | { email }  → sets the jelly_view_as cookie (2h)
 *   DELETE                          → clears it
 *
 * Jared needs to see exactly what a beta tester sees when they report a broken
 * screen. Asking for their password isn't an option and reading the DB doesn't
 * reproduce a UI bug.
 *
 * 🔴 WHAT KEEPS THIS SAFE (all three, independently):
 *   1. Minting requires an admin NextAuth session (ADMIN_ALLOWLIST_EMAILS).
 *   2. The cookie is only HONOURED in the auth.ts session callback when the
 *      REAL token email is still an admin address — a stolen cookie in an
 *      ordinary session does nothing at all.
 *   3. The session is READ-ONLY: proxy.ts 403s every non-GET to /api/vater
 *      and /api/stripe while the cookie is present. Support looks; support
 *      does not spend the customer's credits or publish to their channel.
 *
 * Every start is written to AdminImpersonation. There is no per-request log
 * because there are no writes to attribute.
 *
 * ⚠️ /hq is PIN-gated (wd_admin), which is a DIFFERENT credential from the
 * NextAuth session this route requires. The /hq card's "View as" button
 * therefore needs Jared to also be signed in at /login with an admin email —
 * necessarily so, because impersonation works by rewriting that very session.
 * The card surfaces the 401 with that instruction rather than failing blank.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-auth";
import {
  buildViewAsCookie,
  clearViewAsCookie,
  VIEW_AS_MAX_AGE,
} from "@/lib/vater/acting-as";
import {
  hasAdminImpersonationTable,
  isMissingRelationError,
} from "@/lib/vater/beta-schema";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Audit row. Best-effort: a missing audit table must not block support. */
async function recordImpersonation(
  adminEmail: string,
  targetUserId: string,
  path: string | null,
): Promise<void> {
  try {
    if (!(await hasAdminImpersonationTable())) return;
    await prisma.$executeRaw`
      INSERT INTO "AdminImpersonation" ("id", "adminEmail", "targetUserId", "path", "createdAt")
      VALUES (gen_random_uuid()::text, ${adminEmail}, ${targetUserId}, ${path}, CURRENT_TIMESTAMP)
    `;
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[view-as] audit write failed", err);
    }
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminApiSession();
  if (!gate.ok) return gate.response;

  let body: { userId?: unknown; email?: unknown; path?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const path = typeof body.path === "string" ? body.path.slice(0, 200) : null;

  if (!userId && !email) {
    return NextResponse.json({ error: "userId or email required" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: userId ? { id: userId } : { email },
    select: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "No such user" }, { status: 404 });
  }

  // Impersonating yourself is a no-op that would only confuse the banner.
  if (target.id === gate.session.userId) {
    return NextResponse.json(
      { error: "That's your own account — nothing to view as." },
      { status: 400 },
    );
  }

  await recordImpersonation(gate.session.email, target.id, path);
  queueVaterEvent({
    userId: target.id,
    kind: "admin.view_as",
    message: `Support (${gate.session.email}) started a read-only view of this account.`,
    level: "warn",
    data: { adminEmail: gate.session.email, path },
  });

  console.warn(
    `[view-as] ${gate.session.email} → ${target.email ?? target.id} (read-only, ${VIEW_AS_MAX_AGE}s)`,
  );

  const response = NextResponse.json({
    ok: true,
    target: { id: target.id, email: target.email },
    expiresInSeconds: VIEW_AS_MAX_AGE,
    readOnly: true,
  });
  response.cookies.set(buildViewAsCookie(target.id));
  return response;
}

export async function DELETE() {
  // No admin gate on the exit path on purpose: clearing the cookie can only
  // ever REDUCE access, and a user who somehow ends up with a stale cookie
  // must always be able to get out of it.
  const response = NextResponse.json({ ok: true, viewingAs: null });
  response.cookies.set(clearViewAsCookie());
  return response;
}
