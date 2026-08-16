/**
 * PATCH  /api/vater/me/team/{userId} — { role: "editor" | "viewer" }
 * DELETE /api/vater/me/team/{userId} — remove the seat
 *
 * Owner-only, session-gated. Both operations refuse to touch the org owner's
 * own seat — that rule lives in the SQL (`o."ownerUserId" <> m."userId"`), not
 * in a check here, so there is no ordering of requests that can leave a team
 * with no owner.
 *
 * Removing a seat removes VISIBILITY, nothing else. The projects that person
 * created stay theirs, stay billed to them, and stop being visible to the rest
 * of the team — which is the same thing that happens to everyone else's
 * projects from their side. Nothing is deleted and no credit moves.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  getUserOrg,
  hasOrgTables,
  removeOrgMember,
  setOrgMemberRole,
  type OrgRole,
} from "@/lib/vater/org-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

const NOT_READY = {
  error: "FEATURE_NOT_READY",
  message: "Team seats are deployed but the database migration has not been applied yet.",
} as const;

type Ctx = { params: Promise<{ userId: string }> };

/** Resolve the caller's org and confirm they own it. */
async function requireOwner(
  sessionUserId: string,
): Promise<{ ok: true; orgId: string } | { ok: false; response: NextResponse }> {
  const membership = await getUserOrg(sessionUserId);
  if (!membership) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "NO_TEAM", message: "You are not on a team." },
        { status: 404, headers: NO_STORE },
      ),
    };
  }
  if (membership.org.ownerUserId !== sessionUserId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "FORBIDDEN", message: "Only the team owner can manage seats." },
        { status: 403, headers: NO_STORE },
      ),
    };
  }
  return { ok: true, orgId: membership.org.id };
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasOrgTables())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  const owner = await requireOwner(session.user.id);
  if (!owner.ok) return owner.response;

  const { userId } = await ctx.params;

  let body: { role?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  // "owner" is not assignable: transferring ownership moves who pays, and
  // that is a billing decision, not a dropdown.
  if (body.role !== "editor" && body.role !== "viewer") {
    return NextResponse.json(
      { error: "BAD_ROLE", message: "role must be 'editor' or 'viewer'." },
      { status: 400, headers: NO_STORE },
    );
  }

  const changed = await setOrgMemberRole(owner.orgId, userId, body.role as OrgRole);
  if (!changed) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "No such seat on this team (the owner's own seat cannot be changed).",
      },
      { status: 404, headers: NO_STORE },
    );
  }
  console.log(`[me/team] org=${owner.orgId} ${userId} -> ${body.role}`);
  return NextResponse.json({ ok: true, userId, role: body.role }, { headers: NO_STORE });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasOrgTables())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  const owner = await requireOwner(session.user.id);
  if (!owner.ok) return owner.response;

  const { userId } = await ctx.params;
  const removed = await removeOrgMember(owner.orgId, userId);
  if (!removed) {
    return NextResponse.json(
      {
        error: "NOT_FOUND",
        message: "No such seat on this team (the owner cannot be removed).",
      },
      { status: 404, headers: NO_STORE },
    );
  }
  console.log(`[me/team] org=${owner.orgId} removed ${userId}`);
  return NextResponse.json({ ok: true, removed: userId }, { headers: NO_STORE });
}
