/**
 * eBay environment helpers — picks API + auth hosts based on EBAY_ENVIRONMENT.
 */

export type EbayEnvironment = "sandbox" | "production";

export function ebayEnvironment(): EbayEnvironment {
  const raw = (process.env.EBAY_ENVIRONMENT || "production").toLowerCase();
  return raw === "sandbox" ? "sandbox" : "production";
}

export function ebayApiBase(env: EbayEnvironment = ebayEnvironment()): string {
  return env === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

export function ebayAuthBase(env: EbayEnvironment = ebayEnvironment()): string {
  return env === "sandbox"
    ? "https://auth.sandbox.ebay.com"
    : "https://auth.ebay.com";
}

/** OAuth scopes our Sell API workflow needs. */
export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
];

export function ebayAppCredentials(): { clientId: string; clientSecret: string; ruName: string } {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  const ruName = process.env.EBAY_RU_NAME;
  if (!clientId || !clientSecret || !ruName) {
    throw new Error(
      "eBay app credentials missing — set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RU_NAME"
    );
  }
  return { clientId, clientSecret, ruName };
}
