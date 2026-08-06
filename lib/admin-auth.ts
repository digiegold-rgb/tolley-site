import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

type AdminSession = {
  userId: string;
  email: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getAdminAllowlist() {
  const source =
    process.env.ADMIN_ALLOWLIST_EMAILS || process.env.ADMIN_ALLOWLIST || "";
  return source
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

function getVaterAdminAllowlist() {
  const source = process.env.VATER_ADMIN_ALLOWLIST_EMAILS || "";
  return source
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

/**
 * Jelly Studio (/animate) full-access allowlist.
 *
 * Deliberately SEPARATE from VATER_ADMIN_ALLOWLIST_EMAILS. That flag also
 * gates /vater/budget/* (Plaid accounts, net worth, transactions) and
 * /vater/observer/*, so it can't be used to hand a collaborator the video
 * studio without also handing them the owner's bank data.
 *
 * This list grants exactly two things: visibility of every YouTubeProject
 * (including the legacy userId=null ones) and a bypass of the pay-per-video
 * trial caps / budget checks. Nothing else.
 */
function getVaterStudioAllowlist() {
  const source = process.env.VATER_STUDIO_ALLOWLIST_EMAILS || "";
  return source
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  const normalized = normalizeEmail(email);
  const allowlist = getAdminAllowlist();
  return allowlist.includes(normalized);
}

export function isVaterAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  if (isAdminEmail(email)) {
    return true;
  }
  const normalized = normalizeEmail(email);
  return getVaterAdminAllowlist().includes(normalized);
}

/**
 * True for anyone who should get the full Jelly Studio experience: explicit
 * studio-allowlist members, plus site admins and vater admins (who already
 * had it via the old isVaterAdminEmail path — this keeps them unchanged).
 */
export function isVaterStudioEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  if (isVaterAdminEmail(email)) {
    return true;
  }
  const normalized = normalizeEmail(email);
  return getVaterStudioAllowlist().includes(normalized);
}

/**
 * True only for studio-allowlist members who are NOT admins of anything else.
 * These users are confined to /animate by proxy.ts — they get the studio and
 * no other part of tolley.io.
 */
export function isStudioOnlyEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  if (isAdminEmail(email) || isVaterAdminEmail(email)) {
    return false;
  }
  return getVaterStudioAllowlist().includes(normalizeEmail(email));
}

export async function requireAdminPageSession(
  callbackPath = "/admin",
): Promise<AdminSession> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  if (!isAdminEmail(email)) {
    redirect("/");
  }

  return {
    userId,
    email: normalizeEmail(email as string),
  };
}

export async function requireAdminApiSession(): Promise<
  | {
      ok: true;
      session: AdminSession;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 }),
    };
  }

  if (!isAdminEmail(email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    session: {
      userId,
      email: normalizeEmail(email as string),
    },
  };
}

export async function requireVaterAdminPageSession(
  callbackPath = "/vater/youtube",
): Promise<AdminSession> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  if (!isVaterAdminEmail(email)) {
    redirect("/");
  }

  return {
    userId,
    email: normalizeEmail(email as string),
  };
}

export async function requireVaterAdminApiSession(): Promise<
  | {
      ok: true;
      session: AdminSession;
    }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 }),
    };
  }

  if (!isVaterAdminEmail(email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    session: {
      userId,
      email: normalizeEmail(email as string),
    },
  };
}
