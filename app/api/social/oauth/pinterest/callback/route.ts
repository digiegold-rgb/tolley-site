import { NextRequest, NextResponse } from "next/server";
import { saveStoredToken } from "@/lib/social/token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const BOARDS_URL = "https://api.pinterest.com/v5/boards?page_size=25";

function esc(s: string) {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
}
function html(body: string) {
  return new NextResponse(
    `<!doctype html><meta charset=utf-8><title>Pinterest re-auth</title>` +
      `<body style="font-family:system-ui;background:#0a0a0f;color:#e5e5e5;padding:32px;line-height:1.5">` +
      `<div style="max-width:720px;margin:0 auto;border:1px solid #ffffff22;border-radius:16px;padding:24px;background:#ffffff08">${body}` +
      `<p style="margin-top:24px"><a style="color:#34d399" href="/social">← back to /social</a></p></div></body>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("pin_oauth_state")?.value;
  if (!code) return html(`<h1>Pinterest ✗</h1><p>No authorization code returned.</p>`);
  if (!state || state !== cookieState) {
    return html(`<h1>Pinterest ✗</h1><p>State mismatch (CSRF guard). Try the link again.</p>`);
  }

  const appId = process.env.PINTEREST_APP_ID?.trim();
  const appSecret = process.env.PINTEREST_APP_SECRET?.trim();
  if (!appId || !appSecret) return html(`<h1>Pinterest ✗</h1><p>App credentials missing in env.</p>`);

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/social/oauth/pinterest/callback`;
  const basic = Buffer.from(`${appId}:${appSecret}`).toString("base64");

  // 1. code -> access + refresh token
  const tokRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  if (!tokRes.ok) {
    return html(`<h1>Pinterest ✗</h1><p>Token exchange failed:</p><pre>${esc((await tokRes.text()).slice(0, 500))}</pre>`);
  }
  const tok = (await tokRes.json()) as {
    access_token: string; refresh_token?: string; expires_in?: number;
  };

  // 2. list boards -> pick the default (prefer one named for Amazon/Haul finds)
  const boardsRes = await fetch(BOARDS_URL, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const boards = boardsRes.ok
    ? (((await boardsRes.json()) as { items?: { id: string; name: string }[] }).items ?? [])
    : [];
  const preferred =
    boards.find((b) => /amazon|haul|find|treasure|deal/i.test(b.name)) ?? boards[0];

  if (!preferred) {
    return html(
      `<h1>Pinterest ⚠</h1><p>Connected, but this account has <b>no boards</b>. Create a board ` +
        `(e.g. "Amazon Finds") on Pinterest, then run this link again so a default board can be saved.</p>`,
    );
  }

  await saveStoredToken("pinterest", {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token ?? null,
    accountId: preferred.id, // default board id — postPinterest reads this
    username: preferred.name,
    scopes: ["boards:read", "pins:read", "pins:write"],
  });

  const rows = boards.map((b) => `<li>${esc(b.name)}${b.id === preferred.id ? " ✅ (default)" : ""}</li>`).join("");
  return html(
    `<h1>Pinterest <span style="color:#34d399">✓</span></h1>` +
      `<p><b>Connected.</b> Pins will publish to board <b>${esc(preferred.name)}</b> with each product's direct Amazon affiliate link. Nothing to paste.</p>` +
      `<p style="color:#ffffff88">Boards found:</p><ul>${rows}</ul>`,
  );
}
