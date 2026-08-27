/**
 * POST /api/vater/workspaces/switch { id }
 *
 * Sets the signed jelly_ws cookie to one of this login's live tabs (or clears
 * it when `id` is the login itself). The client then does a FULL reload — the
 * session identity changes, so every cached fetch under it must be thrown
 * away (same rule as exiting "view as", components/animate/ViewAsBanner.tsx).
 *
 * The HMAC is bound to the ROOT login: nothing here can be replayed for
 * another account. Ownership is checked against the table, so a guessed id
 * that isn't yours is a 404, never a switch.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { STUDIO_HOME } from "@/lib/vater/product";
import { FEATURE_NOT_READY } from "@/lib/vater/beta-schema";
import {
  buildWsCookie,
  clearWsCookie,
  hasWorkspaceTable,
  listWorkspaces,
} from "@/lib/vater/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * GET /api/vater/workspaces/switch?to=<tabId>
 *
 * The deep-link form used by app/animate/page.tsx (`/animate?w=<tabId>`).
 * Same checks as POST, then a 303 back to /animate. Unknown / foreign ids
 * just land on /animate unchanged — never an error page for a stale link.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  // `back` = which front door to land on; allowlisted to the studio homes so
  // the redirect can never be pointed off-site. Default stays /animate.
  const backParam = request.nextUrl.searchParams.get("back") ?? "";
  const backPath = Object.values(STUDIO_HOME).includes(backParam) ? backParam : STUDIO_HOME.jelly;
  const home = new URL(backPath, request.url);
  if (!session?.user?.id) return NextResponse.redirect(home, 303);
  const to = request.nextUrl.searchParams.get("to") ?? "";
  const rootUserId = session.workspace?.rootUserId ?? session.user.id;
  const res = NextResponse.redirect(home, 303);
  if (!(await hasWorkspaceTable())) return res;
  if (!to || to === rootUserId) {
    res.cookies.set(clearWsCookie());
    return res;
  }
  const mine = await listWorkspaces(rootUserId);
  const target = mine.find((r) => r.userId === to);
  if (target) res.cookies.set(buildWsCookie(rootUserId, target.userId));
  return res;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasWorkspaceTable())) {
    return NextResponse.json(FEATURE_NOT_READY, { status: 503, headers: NO_STORE });
  }
  let body: { id?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const rootUserId = session.workspace?.rootUserId ?? session.user.id;

  if (!id || id === rootUserId) {
    const res = NextResponse.json({ ok: true, activeId: rootUserId }, { headers: NO_STORE });
    res.cookies.set(clearWsCookie());
    return res;
  }

  const mine = await listWorkspaces(rootUserId);
  const target = mine.find((r) => r.userId === id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  const res = NextResponse.json(
    { ok: true, activeId: target.userId, name: target.name },
    { headers: NO_STORE },
  );
  res.cookies.set(buildWsCookie(rootUserId, target.userId));
  return res;
}
