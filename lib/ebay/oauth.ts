/**
 * eBay OAuth 2.0 helpers — authorization code grant for user consent,
 * refresh-token rotation, access-token caching.
 *
 * Two token types:
 *   - **Refresh token**: 18-month TTL. Stored in EbayAuth.refreshToken.
 *     Obtained once via the consent flow.
 *   - **Access token**: 2-hour TTL. Used as Bearer on every Sell API call.
 *     Cached in EbayAuth.accessToken; refreshed on demand.
 *
 * eBay docs: https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
 */

import { prisma } from "@/lib/prisma";
import {
  EBAY_SCOPES,
  ebayApiBase,
  ebayAuthBase,
  ebayAppCredentials,
  ebayEnvironment,
  type EbayEnvironment,
} from "./env";

const REFRESH_TOKEN_DAYS = 540; // ~18 months

export interface EbayConsentParams {
  state: string;
  scopes?: string[];
}

/** Build the URL the user visits to grant our app access to their seller account. */
export function buildConsentUrl({ state, scopes = EBAY_SCOPES }: EbayConsentParams): string {
  const { clientId, ruName } = ebayAppCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: ruName,
    scope: scopes.join(" "),
    state,
    prompt: "login",
  });
  return `${ebayAuthBase()}/oauth2/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
}

function basicAuthHeader(): string {
  const { clientId, clientSecret } = ebayAppCredentials();
  const encoded = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return `Basic ${encoded}`;
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(`${ebayApiBase()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay token exchange failed (${res.status}): ${text.slice(0, 400)}`);
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Exchange an authorization code (received on the OAuth callback) for a
 * refresh token + access token. Persists to EbayAuth.
 */
export async function exchangeAuthorizationCode(code: string): Promise<{ id: string }> {
  const { ruName } = ebayAppCredentials();
  const env = ebayEnvironment();

  const tokens = await postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ruName,
    })
  );

  if (!tokens.refresh_token) {
    throw new Error("eBay token response missing refresh_token");
  }

  const now = new Date();
  const refreshExpiresInSec = tokens.refresh_token_expires_in ?? REFRESH_TOKEN_DAYS * 86_400;
  const refreshExpiresAt = new Date(now.getTime() + refreshExpiresInSec * 1000);
  const accessExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000);

  // We currently support a single connection per environment. The compound
  // unique on (environment, sellerEbayId) allows multiple null-seller rows
  // in Postgres, so we manually find-then-update/create to avoid duplicates.
  const existing = await prisma.ebayAuth.findFirst({
    where: { environment: env },
    orderBy: { updatedAt: "desc" },
  });

  const row = existing
    ? await prisma.ebayAuth.update({
        where: { id: existing.id },
        data: {
          refreshToken: tokens.refresh_token,
          refreshTokenExpiresAt: refreshExpiresAt,
          accessToken: tokens.access_token,
          accessTokenExpiresAt: accessExpiresAt,
          scopes: EBAY_SCOPES.join(" "),
          lastRefreshError: null,
        },
      })
    : await prisma.ebayAuth.create({
        data: {
          environment: env,
          refreshToken: tokens.refresh_token,
          refreshTokenExpiresAt: refreshExpiresAt,
          accessToken: tokens.access_token,
          accessTokenExpiresAt: accessExpiresAt,
          scopes: EBAY_SCOPES.join(" "),
        },
      });

  return { id: row.id };
}

/**
 * Get a valid access token. Refreshes from refresh_token if the cached one
 * is expired (or about to expire). Caller does NOT need to handle expiry.
 */
export async function getAccessToken(env: EbayEnvironment = ebayEnvironment()): Promise<string> {
  const auth = await prisma.ebayAuth.findFirst({
    where: { environment: env },
    orderBy: { updatedAt: "desc" },
  });
  if (!auth) {
    throw new Error(`eBay not connected for ${env}. Run the OAuth flow at /shop/admin first.`);
  }

  // Use cached access token if it has more than 60s of life left.
  const now = Date.now();
  if (
    auth.accessToken &&
    auth.accessTokenExpiresAt &&
    auth.accessTokenExpiresAt.getTime() - now > 60_000
  ) {
    return auth.accessToken;
  }

  // Refresh.
  if (auth.refreshTokenExpiresAt.getTime() < now) {
    throw new Error(
      `eBay refresh token expired ${auth.refreshTokenExpiresAt.toISOString()}. ` +
        `Re-run consent at /shop/admin → Connect eBay.`
    );
  }

  try {
    const tokens = await postToken(
      new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.refreshToken,
        scope: EBAY_SCOPES.join(" "),
      })
    );
    const accessExpiresAt = new Date(now + tokens.expires_in * 1000);
    await prisma.ebayAuth.update({
      where: { id: auth.id },
      data: {
        accessToken: tokens.access_token,
        accessTokenExpiresAt: accessExpiresAt,
        // eBay sometimes rotates the refresh token on refresh — honor it.
        ...(tokens.refresh_token
          ? {
              refreshToken: tokens.refresh_token,
              refreshTokenExpiresAt: tokens.refresh_token_expires_in
                ? new Date(now + tokens.refresh_token_expires_in * 1000)
                : auth.refreshTokenExpiresAt,
            }
          : {}),
        lastRefreshError: null,
      },
    });
    return tokens.access_token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.ebayAuth.update({
      where: { id: auth.id },
      data: { lastRefreshError: message.slice(0, 500) },
    });
    throw err;
  }
}

/** Returns null if not connected; otherwise minimal status for admin UI. */
export async function getEbayConnectionStatus(env: EbayEnvironment = ebayEnvironment()) {
  const auth = await prisma.ebayAuth.findFirst({
    where: { environment: env },
    orderBy: { updatedAt: "desc" },
  });
  if (!auth) return null;
  return {
    connected: true,
    environment: auth.environment,
    sellerEbayId: auth.sellerEbayId,
    refreshTokenExpiresAt: auth.refreshTokenExpiresAt,
    paymentPolicyId: auth.paymentPolicyId,
    returnPolicyId: auth.returnPolicyId,
    fulfillmentPolicyId: auth.fulfillmentPolicyId,
    defaultLocationKey: auth.defaultLocationKey,
    lastRefreshError: auth.lastRefreshError,
    updatedAt: auth.updatedAt,
  };
}
