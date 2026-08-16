/**
 * PATCH  /api/vater/me/keys/{id} — point this key's completion webhook
 *                                  somewhere else, or clear it
 * DELETE /api/vater/me/keys/{id} — revoke the key
 *
 * Session-gated, and scoped to the caller in the SQL itself (every statement
 * carries `AND "userId" = …`), so a guessed key id belonging to someone else
 * changes nothing and reports the same 404 as an id that never existed.
 *
 * Revocation is a timestamp, not a DELETE. A key that created projects and
 * signed webhook deliveries stays attributable after it is turned off; a row
 * that vanishes takes that history with it.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  hasApiKeyTable,
  normalizeWebhookUrl,
  revokeApiKey,
  setKeyWebhook,
} from "@/lib/vater/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

const NOT_READY = {
  error: "FEATURE_NOT_READY",
  message:
    "The public API is deployed but its database migration has not been applied yet.",
} as const;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasApiKeyTable())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  const { id } = await ctx.params;

  let body: { webhookUrl?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  // An explicit null or empty string clears the webhook; anything else has to
  // survive validation. Never silently store an unusable URL.
  let webhookUrl: string | null = null;
  const raw = body.webhookUrl;
  if (typeof raw === "string" && raw.trim()) {
    webhookUrl = normalizeWebhookUrl(raw);
    if (!webhookUrl) {
      return NextResponse.json(
        {
          error: "BAD_WEBHOOK_URL",
          message:
            "Webhook URLs must be https:// and point at a public host (no localhost or private IPs).",
        },
        { status: 400, headers: NO_STORE },
      );
    }
  } else if (raw !== null && raw !== undefined && raw !== "") {
    return NextResponse.json(
      { error: "BAD_WEBHOOK_URL", message: "webhookUrl must be a string or null." },
      { status: 400, headers: NO_STORE },
    );
  }

  const ok = await setKeyWebhook(session.user.id, id, webhookUrl);
  if (!ok) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "No such key." },
      { status: 404, headers: NO_STORE },
    );
  }
  return NextResponse.json({ ok: true, webhookUrl }, { headers: NO_STORE });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasApiKeyTable())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  const { id } = await ctx.params;
  const ok = await revokeApiKey(session.user.id, id);
  if (!ok) {
    // Also the answer for a key that was already revoked — the caller's
    // intent ("this key must not work") is satisfied either way, but saying
    // so is more honest than a bare 200.
    return NextResponse.json(
      { error: "NOT_FOUND", message: "No such active key." },
      { status: 404, headers: NO_STORE },
    );
  }
  console.log(`[me/keys] user=${session.user.id} revoked key=${id}`);
  return NextResponse.json({ ok: true, revoked: id }, { headers: NO_STORE });
}
