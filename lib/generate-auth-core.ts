/**
 * Pure Jared/admin helpers for /generate Modal jobs (no NextAuth imports).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function resolveGenerateActor(input: {
  hqRole: string | null;
  shopAdmin: boolean;
  adminEmail: string | null;
}): string | null {
  if (input.hqRole) return `hq:${input.hqRole}`;
  if (input.shopAdmin) return "shop-admin";
  if (input.adminEmail) return input.adminEmail.trim().toLowerCase();
  return null;
}

export function generateWebhookSecret(env: NodeJS.ProcessEnv = process.env): string {
  return (env.GENERATE_WEBHOOK_SECRET || env.MODAL_WEBHOOK_SECRET || "").trim();
}

export function signGenerateWebhook(raw: string, secret: string): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export function verifyGenerateWebhook(
  raw: string,
  headers: { get(name: string): string | null },
  secret: string,
): boolean {
  if (!secret) return false;
  const bearer = headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const token = bearer.slice(7).trim();
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const header =
    headers.get("x-generate-signature") ||
    headers.get("x-generate-webhook-secret") ||
    "";
  if (!header) return false;
  const expected = signGenerateWebhook(raw, secret);
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length === b.length && timingSafeEqual(a, b)) return true;
  const direct = Buffer.from(header);
  const sec = Buffer.from(secret);
  return direct.length === sec.length && timingSafeEqual(direct, sec);
}
