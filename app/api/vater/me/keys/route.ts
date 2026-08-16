/**
 * GET  /api/vater/me/keys  — the caller's API keys (never the secrets)
 * POST /api/vater/me/keys  — mint one; the plaintext is in the reply and
 *                            nowhere else, ever
 *
 * Session-gated (the /animate → API Keys screen). Deliberately NOT reachable
 * with an API key: a leaked key must not be able to mint itself a replacement
 * or read the webhook targets of its siblings. Escalation from "can call the
 * API" to "can manage the account's API access" needs the browser session.
 *
 * ⚠️ Writes here are blocked during an admin support session — proxy.ts 403s
 * every non-GET to /api/vater while jelly_view_as is set. That is correct:
 * minting a customer's credential on their behalf is not support, and the
 * plaintext would land in the admin's browser.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  createApiKey,
  countLiveApiKeys,
  hasApiKeyTable,
  listApiKeys,
  normalizeWebhookUrl,
} from "@/lib/vater/api-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** Live keys per account. Enough for prod + staging + a spare; not a farm. */
const MAX_LIVE_KEYS = 10;

const NOT_READY = {
  error: "FEATURE_NOT_READY",
  message:
    "The public API is deployed but its database migration has not been applied yet. " +
    "Run prisma/migrations/20260816_api_keys_orgs/migration.sql (staged on /hq → Must Complete).",
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasApiKeyTable())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  const keys = await listApiKeys(session.user.id);
  return NextResponse.json(
    {
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        webhookUrl: k.webhookUrl,
        lastUsedAt: k.lastUsedAt,
        revokedAt: k.revokedAt,
        createdAt: k.createdAt,
      })),
      max: MAX_LIVE_KEYS,
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasApiKeyTable())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  let body: { name?: unknown; webhookUrl?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  const live = await countLiveApiKeys(session.user.id);
  if (live >= MAX_LIVE_KEYS) {
    return NextResponse.json(
      {
        error: "TOO_MANY_KEYS",
        message: `You already have ${MAX_LIVE_KEYS} active keys. Revoke one before creating another.`,
      },
      { status: 409, headers: NO_STORE },
    );
  }

  // A webhook URL that fails validation is an ERROR, not a silent drop: the
  // whole point of setting one is that you expect to be called back, and a
  // key that quietly has no webhook looks identical to one that is broken.
  let webhookUrl: string | null = null;
  if (typeof body.webhookUrl === "string" && body.webhookUrl.trim()) {
    webhookUrl = normalizeWebhookUrl(body.webhookUrl);
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
  }

  try {
    const { row, plaintext } = await createApiKey(
      session.user.id,
      typeof body.name === "string" ? body.name : "",
      webhookUrl,
    );
    console.log(`[me/keys] user=${session.user.id} minted key=${row.id} (${row.prefix}…)`);
    return NextResponse.json(
      {
        // The ONLY time this value exists outside the caller's own storage.
        key: plaintext,
        id: row.id,
        name: row.name,
        prefix: row.prefix,
        webhookUrl: row.webhookUrl,
        createdAt: row.createdAt,
      },
      { status: 201, headers: NO_STORE },
    );
  } catch (err) {
    console.error("[me/keys] create failed", err);
    return NextResponse.json(
      { error: "CREATE_FAILED", message: "Could not create that key." },
      { status: 500, headers: NO_STORE },
    );
  }
}
