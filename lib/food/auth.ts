import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getToken } from "next-auth/jwt";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isFoodAccessGranted } from "@/lib/food-subscription";
import { hasValidShopAdminCookie } from "@/lib/shop-auth";

/**
 * JWT subject when auth.ts has wiped session.user for a pending MFA challenge.
 * Only consulted after the shop_admin PIN cookie wins — this is not an MFA
 * bypass. Used so Jared's existing login still maps to his household.
 */
async function pendingSessionUserId(): Promise<string | null> {
  try {
    const h = await headers();
    const cookieHeader = h.get("cookie") || "";
    const secureCookie = cookieHeader.includes("__Secure-authjs.session-token");
    const cookieName = secureCookie
      ? "__Secure-authjs.session-token"
      : "authjs.session-token";
    const token = await getToken({
      req: new Request("https://tolley.io", { headers: h }),
      secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
      cookieName,
    });
    return typeof token?.sub === "string" && token.sub ? token.sub : null;
  } catch {
    return null;
  }
}

export type FoodAccessVia = "pin" | "session";

export type FoodAccess =
  | { ok: true; via: FoodAccessVia; userId: string | null }
  | { ok: false; via: null; userId: null };

/**
 * Who may use Ruthann's Kitchen.
 *
 * 1. shop_admin PIN cookie first (same credential as /tv / shop). A pending
 *    MFA challenge must not win — auth.ts wipes session.user when
 *    mfaRequired is set, which is why /food used to bounce to
 *    /login/mfa-challenge. Do not return false on mfaRequired before the cookie.
 * 2. Completed NextAuth session for paying SaaS kitchen users.
 *
 * PIN is family/admin unlock only. It is not an email MFA exemption.
 * FOOD_FAMILY_USER_ID maps the PIN kiosk to the family household owner
 * when session.user is missing (anonymous PIN or MFA-pending).
 */
export async function resolveFoodAccess(): Promise<FoodAccess> {
  const pinOk = await hasValidShopAdminCookie();
  const session = await auth();

  if (pinOk) {
    const userId =
      session?.user?.id ||
      process.env.FOOD_FAMILY_USER_ID ||
      (await pendingSessionUserId()) ||
      null;
    return { ok: true, via: "pin", userId };
  }

  if (session?.user?.id && !session.mfaRequired) {
    return { ok: true, via: "session", userId: session.user.id };
  }

  return { ok: false, via: null, userId: null };
}

export async function getFoodApiUserId(): Promise<string | null> {
  const access = await resolveFoodAccess();
  return access.ok ? access.userId : null;
}

/** Owner funnel + public marketing are not family-PIN surfaces. */
export function isFoodPinGateExempt(pathname: string) {
  return (
    pathname === "/food/admin" ||
    pathname.startsWith("/food/admin/") ||
    pathname === "/food/business" ||
    pathname.startsWith("/food/business/")
  );
}

export async function getFoodHousehold() {
  const access = await resolveFoodAccess();
  if (!access.ok || !access.userId) return null;

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: access.userId },
    include: { members: true },
  });

  return household ? { ...household, userId: access.userId } : null;
}

export async function requireFoodHousehold() {
  const household = await getFoodHousehold();
  if (!household) throw new Error("No household found");
  return household;
}

/**
 * Gate a /food/** page. Redirects appropriately:
 *   - No PIN and no completed session → /food (layout shows the PIN gate)
 *   - PIN without a mapped household → /food/settings
 *   - Session without a household → /food/onboarding
 *   - Session without an active subscription → /food/billing
 *   - PIN skips the SaaS paywall (family kitchen)
 *
 * /food/admin is not routed through this helper and stays MFA-strict.
 */
export async function requireFoodAccess(options: { callbackUrl?: string } = {}) {
  const callbackUrl = options.callbackUrl ?? "/food";
  const access = await resolveFoodAccess();
  if (!access.ok) {
    // Do not send MFA-pending browsers to /login — that short-circuits
    // into /login/mfa-challenge. The kitchen PIN gate lives on /food.
    redirect("/food");
  }

  if (!access.userId) {
    redirect(access.via === "pin" ? "/food/settings" : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: access.userId },
    include: { members: true },
  });

  if (!household) {
    redirect(access.via === "pin" ? "/food/settings" : "/food/onboarding");
  }

  if (access.via !== "pin" && !isFoodAccessGranted(household.subscriptionStatus)) {
    redirect("/food/billing");
  }

  const session = await auth();
  return {
    session,
    userId: access.userId,
    household,
    via: access.via,
  };
}

/**
 * Lighter guard: requires kitchen access but does NOT require an active
 * subscription. Use on billing, onboarding, and success pages where a SaaS
 * user legitimately needs access before paying. PIN users are already
 * unlocked and should not be sent through the signup funnel.
 */
export async function requireFoodSession(options: { callbackUrl?: string } = {}) {
  const callbackUrl = options.callbackUrl ?? "/food";
  const access = await resolveFoodAccess();
  if (!access.ok) {
    redirect("/food");
  }

  if (!access.userId) {
    redirect(access.via === "pin" ? "/food/settings" : `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  const household = await prisma.foodHousehold.findUnique({
    where: { userId: access.userId },
    include: { members: true },
  });

  const session = await auth();
  return {
    session,
    userId: access.userId,
    household,
    via: access.via,
  };
}
