/**
 * Jared / admin gate for /generate Modal jobs.
 *
 * Accepts the same cookies/sessions Jared already uses:
 *   - HQ PIN cookie (`validateWdAdmin` — existing /generate quickgen)
 *   - Shop admin PIN cookie (`validateShopAdmin`)
 *   - NextAuth email on ADMIN_ALLOWLIST_EMAILS (`requireAdminApiSession`)
 *
 * Modal tokens never leave the server. Webhook uses a separate shared secret.
 */

import { NextResponse } from "next/server";

import { requireAdminApiSession } from "@/lib/admin-auth";
import {
  resolveGenerateActor,
} from "@/lib/generate-auth-core";
import { validateShopAdmin } from "@/lib/shop-auth";
import { validateWdAdmin } from "@/lib/wd-auth";

export {
  generateWebhookSecret,
  resolveGenerateActor,
  signGenerateWebhook,
  verifyGenerateWebhook,
} from "@/lib/generate-auth-core";

export type GenerateActor = {
  createdBy: string;
};

export async function requireGenerateAdmin(): Promise<
  | { ok: true; createdBy: string }
  | { ok: false; response: NextResponse }
> {
  const wd = await validateWdAdmin();
  if (wd.authed) {
    return { ok: true, createdBy: resolveGenerateActor({ hqRole: wd.role, shopAdmin: false, adminEmail: null })! };
  }

  let shopAdmin = false;
  try {
    shopAdmin = await validateShopAdmin();
  } catch {
    shopAdmin = false;
  }
  if (shopAdmin) {
    return { ok: true, createdBy: "shop-admin" };
  }

  const admin = await requireAdminApiSession();
  if (admin.ok) {
    return { ok: true, createdBy: admin.session.email };
  }
  return { ok: false, response: admin.response };
}
