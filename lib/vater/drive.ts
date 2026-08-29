/**
 * lib/vater/drive.ts — per-user Google Drive link for /animate (2026-08-28).
 *
 * Scope is the NON-sensitive `drive.file` (no Google verification review):
 * the app only ever sees files it created itself. One VaterDriveConnection
 * per ROOT login (resolveTenantIdentity — workspace tabs share the owner's
 * Drive). Same GCP OAuth client as the YouTube posting flow
 * (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET); the redirect URI
 * `https://www.tolley.io/api/vater/drive/oauth/callback` must be registered
 * on that client and the Google Drive API enabled on the project.
 *
 * Google Docs are created with Drive `files.create` (multipart) using
 * mimeType `application/vnd.google-apps.document` + a text/plain body —
 * Drive converts on upload, so no Docs API / extra scope is needed.
 *
 * Every Google failure is mapped to a typed DriveError so callers can persist
 * a code + a short human sentence without parsing Google's error envelopes.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import type { VaterDriveConnection } from "@prisma/client";

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "openid",
  "email",
] as const;

export const DRIVE_FOLDER_NAME = "Jelly Scripts";

export type DriveErrorCode = "api_not_enabled" | "revoked" | "quota" | "unknown";

const HUMAN: Record<DriveErrorCode, string> = {
  api_not_enabled:
    "Google Drive API is not enabled for this app yet — the owner has been notified",
  revoked: "Google Drive access was revoked — reconnect your Drive to keep syncing",
  quota: "Google Drive is rate-limiting this app right now — try again in a minute",
  unknown: "Google Drive returned an unexpected error",
};

export class DriveError extends Error {
  readonly code: DriveErrorCode;
  readonly status: number | null;
  readonly detail: string;
  constructor(code: DriveErrorCode, detail = "", status: number | null = null) {
    super(HUMAN[code]);
    this.name = "DriveError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
  /** "<code>: <message>" — what gets persisted on the row. */
  get persisted(): string {
    return `${this.code}: ${this.message}`;
  }
}

export function isDriveError(err: unknown): err is DriveError {
  return err instanceof DriveError;
}

export function driveClientEnv(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * The exact redirect URI registered on the GCP client. Derived from the
 * request everywhere except production, which is forced to the www host —
 * the apex 301s and Google matches the URI byte-for-byte.
 */
export function driveRedirectUri(request: Request): string {
  const origin =
    process.env.VERCEL_ENV === "production"
      ? "https://www.tolley.io"
      : new URL(request.url).origin;
  return `${origin}/api/vater/drive/oauth/callback`;
}

/** Classify a Google API error body + HTTP status into a DriveError. */
export function classifyGoogleError(status: number, bodyText: string): DriveError {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    /* not JSON */
  }
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as {
    error?: string | { code?: number; message?: string; status?: string; errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> };
    error_description?: string;
  };
  const errObj = typeof obj.error === "object" && obj.error ? obj.error : null;
  const errStr = typeof obj.error === "string" ? obj.error : "";
  const message = errObj?.message ?? obj.error_description ?? bodyText.slice(0, 300);
  const reasons = [
    ...(errObj?.errors ?? []).map((e) => e.reason ?? ""),
    ...(errObj?.details ?? []).map((d) => d.reason ?? ""),
  ];
  const lower = `${message} ${reasons.join(" ")} ${errObj?.status ?? ""}`.toLowerCase();

  if (
    reasons.includes("accessNotConfigured") ||
    reasons.includes("SERVICE_DISABLED") ||
    lower.includes("has not been used in project") ||
    lower.includes("service_disabled") ||
    lower.includes("is disabled")
  ) {
    return new DriveError("api_not_enabled", message, status);
  }
  if (errStr === "invalid_grant" || status === 401) {
    return new DriveError("revoked", message, status);
  }
  if (
    status === 429 ||
    reasons.some((r) => /rateLimit|quota|userRateLimit|dailyLimit/i.test(r)) ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    return new DriveError("quota", message, status);
  }
  return new DriveError("unknown", message, status);
}

async function readError(res: Response): Promise<DriveError> {
  const text = await res.text().catch(() => "");
  return classifyGoogleError(res.status, text);
}

// ── Tokens ──────────────────────────────────────────────────────────────

const EXPIRY_SKEW_MS = 60_000;

/**
 * A valid bearer for this connection. Uses the cached access token when it
 * has >60s left; otherwise refreshes via the OAuth client and caches the
 * result on the row. `invalid_grant` = the user revoked us (or the refresh
 * token rotted) → status "revoked" + DriveError("revoked").
 */
export async function getDriveAccessToken(conn: VaterDriveConnection): Promise<string> {
  if (
    conn.accessToken &&
    conn.accessTokenExpiresAt &&
    conn.accessTokenExpiresAt.getTime() - Date.now() > EXPIRY_SKEW_MS
  ) {
    return conn.accessToken;
  }
  const env = driveClientEnv();
  if (!env) throw new DriveError("unknown", "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET missing");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await readError(res);
    if (err.code === "revoked") {
      await prisma.vaterDriveConnection
        .update({
          where: { id: conn.id },
          data: { status: "revoked", lastError: err.persisted, accessToken: null, accessTokenExpiresAt: null },
        })
        .catch(() => undefined);
    }
    throw err;
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new DriveError("unknown", "token refresh returned no access_token");
  const expiresAt = new Date(Date.now() + Math.max(60, json.expires_in ?? 3600) * 1000);
  await prisma.vaterDriveConnection.update({
    where: { id: conn.id },
    data: { accessToken: json.access_token, accessTokenExpiresAt: expiresAt },
  });
  conn.accessToken = json.access_token;
  conn.accessTokenExpiresAt = expiresAt;
  return json.access_token;
}

/** The Google account's email, fetched once at link time. */
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return typeof json.email === "string" && json.email ? json.email : null;
  } catch {
    return null;
  }
}

/** Best-effort revoke at Google. Never throws. */
export async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
  } catch {
    /* ignore */
  }
}

// ── Folder ──────────────────────────────────────────────────────────────

export function folderUrlFor(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

async function folderAlive(accessToken: string, folderId: string): Promise<boolean> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404) return false;
  if (!res.ok) throw await readError(res);
  const json = (await res.json()) as { trashed?: boolean };
  return !json.trashed;
}

/**
 * The "Jelly Scripts" folder id, creating it when the row has none or the
 * user trashed/deleted the old one. Persists folderId + folderUrl.
 */
export async function ensureFolder(conn: VaterDriveConnection): Promise<string> {
  const accessToken = await getDriveAccessToken(conn);
  if (conn.folderId && (await folderAlive(accessToken, conn.folderId))) {
    return conn.folderId;
  }
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!res.ok) throw await readError(res);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new DriveError("unknown", "folder create returned no id");
  const folderUrl = folderUrlFor(json.id);
  await prisma.vaterDriveConnection.update({
    where: { id: conn.id },
    data: { folderId: json.id, folderUrl, status: "active", lastError: null },
  });
  conn.folderId = json.id;
  conn.folderUrl = folderUrl;
  return json.id;
}

// ── Docs ────────────────────────────────────────────────────────────────

export interface CreatedDoc {
  id: string;
  webViewLink: string;
}

/**
 * Create a Google Doc named `title` containing `text` inside the user's
 * Jelly Scripts folder. Multipart/related upload; Drive converts the
 * text/plain body into a native Doc because of the target mimeType.
 */
export async function createScriptDoc(opts: {
  conn: VaterDriveConnection;
  title: string;
  text: string;
}): Promise<CreatedDoc> {
  const { conn, title, text } = opts;
  const folderId = await ensureFolder(conn);
  const accessToken = await getDriveAccessToken(conn);

  const boundary = `jelly_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({
    name: title,
    mimeType: "application/vnd.google-apps.document",
    parents: [folderId],
  });
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
    `${text}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw await readError(res);
  const json = (await res.json()) as { id?: string; webViewLink?: string };
  if (!json.id) throw new DriveError("unknown", "doc create returned no id");
  return {
    id: json.id,
    webViewLink: json.webViewLink ?? `https://docs.google.com/document/d/${json.id}/edit`,
  };
}
