/**
 * /api/admin/vater/invites — mint and list Jelly Studio beta invite codes.
 *
 *   GET  → every invite, newest first, with its link and spent/remaining count
 *   POST → mint N codes  { count?, maxUses?, email?, note?, expiresInDays? }
 *
 * Auth: requireAdminApiSession (ADMIN_ALLOWLIST_EMAILS). Deliberately the
 * SITE admin list, not VATER_STUDIO_ALLOWLIST_EMAILS — handing someone the
 * studio must not also hand them the ability to let strangers in.
 *
 * The link this returns is the one Jared sends:
 *   https://www.tolley.io/signup?callbackUrl=%2Fanimate&invite=CODE
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";
import {
  FEATURE_NOT_READY,
  hasBetaInviteTable,
  isMissingRelationError,
} from "@/lib/vater/beta-schema";
import {
  formatInviteCode,
  inviteLink,
  listInvites,
  mintInvites,
  type BetaInviteRow,
} from "@/lib/vater/beta-invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(row: BetaInviteRow) {
  const remaining = Math.max(row.maxUses - row.usedCount, 0);
  const expired = Boolean(row.expiresAt && row.expiresAt.getTime() <= Date.now());
  return {
    id: row.id,
    code: row.code,
    display: formatInviteCode(row.code),
    link: inviteLink(row.code),
    email: row.email,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    remaining,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    expired,
    spendable: remaining > 0 && !expired,
    createdBy: row.createdBy,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const gate = await requireAdminApiSession();
  if (!gate.ok) return gate.response;

  if (!(await hasBetaInviteTable())) {
    return NextResponse.json(FEATURE_NOT_READY, { status: 503 });
  }

  try {
    const invites = await listInvites(200);
    return NextResponse.json(
      { invites: invites.map(serialize) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    if (isMissingRelationError(err)) {
      return NextResponse.json(FEATURE_NOT_READY, { status: 503 });
    }
    console.error("[admin/vater/invites] list failed", err);
    return NextResponse.json({ error: "Failed to list invites" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireAdminApiSession();
  if (!gate.ok) return gate.response;

  if (!(await hasBetaInviteTable())) {
    return NextResponse.json(FEATURE_NOT_READY, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const count = Number(body.count ?? 1);
  const maxUses = Number(body.maxUses ?? 1);
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email : null;
  const note = typeof body.note === "string" ? body.note : null;
  const expiresInDays =
    body.expiresInDays === null || body.expiresInDays === undefined
      ? null
      : Number(body.expiresInDays);

  if (!Number.isFinite(count) || count < 1 || count > 50) {
    return NextResponse.json({ error: "count must be 1-50" }, { status: 400 });
  }
  if (!Number.isFinite(maxUses) || maxUses < 1) {
    return NextResponse.json({ error: "maxUses must be at least 1" }, { status: 400 });
  }
  // An email-locked code with multiple uses is almost always a mistake — the
  // point of naming the address is that it's one person's invite.
  if (email && maxUses > 1) {
    return NextResponse.json(
      { error: "An email-locked invite can only have maxUses 1." },
      { status: 400 },
    );
  }

  try {
    const created = await mintInvites({
      count,
      maxUses,
      email,
      note,
      expiresInDays: Number.isFinite(expiresInDays as number) ? (expiresInDays as number) : null,
      createdBy: gate.session.email,
    });

    console.info(
      `[admin/vater/invites] ${gate.session.email} minted ${created.length} invite(s)` +
        (email ? ` for ${email}` : ""),
    );

    return NextResponse.json({ ok: true, invites: created.map(serialize) });
  } catch (err) {
    if (isMissingRelationError(err)) {
      return NextResponse.json(FEATURE_NOT_READY, { status: 503 });
    }
    console.error("[admin/vater/invites] mint failed", err);
    return NextResponse.json({ error: "Failed to mint invites" }, { status: 500 });
  }
}
