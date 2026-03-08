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

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }
  const normalized = normalizeEmail(email);
  const allowlist = getAdminAllowlist();
  return allowlist.includes(normalized);
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
