/**
 * Thin Sell API REST client with auto-refresh on 401.
 *
 * All Sell API calls go through `ebayFetch` so:
 *   - Bearer token is attached automatically
 *   - Content-Language defaults to en-US (eBay requires it on Inventory writes)
 *   - On 401 the token is refreshed and the request retried once
 *   - Non-2xx responses surface a useful error including eBay's error JSON
 */

import { ebayApiBase } from "./env";
import { getAccessToken } from "./oauth";

interface EbayFetchOptions extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** Set to false to suppress retry-on-401 (e.g., the refresh call itself). */
  retryOnAuth?: boolean;
}

export async function ebayFetch<T = unknown>(
  path: string,
  options: EbayFetchOptions = {}
): Promise<T> {
  const { retryOnAuth = true, headers = {}, ...rest } = options;

  const send = async (): Promise<Response> => {
    const token = await getAccessToken();
    return fetch(`${ebayApiBase()}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
        Accept: "application/json",
        ...headers,
      },
      signal: rest.signal ?? AbortSignal.timeout(30_000),
    });
  };

  let res = await send();
  if (res.status === 401 && retryOnAuth) {
    // Force-clear the cached access token by setting expiry to past, then retry.
    // getAccessToken() will fetch a fresh one from refresh_token.
    const { prisma } = await import("@/lib/prisma");
    await prisma.ebayAuth.updateMany({
      data: { accessTokenExpiresAt: new Date(0) },
    });
    res = await send();
  }

  if (res.status === 204) return undefined as unknown as T;

  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const summary =
      typeof body === "object" && body && "errors" in body
        ? JSON.stringify((body as { errors: unknown }).errors).slice(0, 600)
        : (text || "(empty)").slice(0, 600);
    throw new EbayApiError(`eBay ${res.status} ${path}: ${summary}`, res.status, body);
  }

  return body as T;
}

export class EbayApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "EbayApiError";
    this.status = status;
    this.body = body;
  }
}
