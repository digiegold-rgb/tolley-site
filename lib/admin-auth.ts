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
 * This list grants the full studio feature set (script review, Direct,
 * voices, course, the /animate header pill) and a bypass of the
 * pay-per-video trial caps / budget checks. Nothing else.
 *
 * ⚠️ It does NOT grant visibility of other tenants' projects. It used to —
 * studio membership meant "see every YouTubeProject, including the legacy
 * userId=null ones" — which made every studio invite a cross-tenant leak.
 * Only the OWNER tier sees everything now; see lib/vater/project-access.ts.
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

/* ------------------------------------------------------------------ *
 * DB-backed tiers (VaterAccount)
 *
 * The env allowlists above stay as the bootstrap fallback — they are what
 * grants access before anyone has a VaterAccount row, and they keep the
 * owner reachable if the table is ever empty. VaterAccount is the durable
 * source of truth for everyone else, so inviting a beta user is a row insert
 * instead of a Vercel env edit + redeploy.
 *
 * Tiers, highest first:
 *   owner  — sees EVERY tenant's projects (support). Env equivalent:
 *            ADMIN_ALLOWLIST_EMAILS / VATER_ADMIN_ALLOWLIST_EMAILS.
 *   studio — the full studio feature set (script review, Direct, voices,
 *            course, /api/vater/latest) but STILL scoped to their own
 *            projects. Env equivalent: VATER_STUDIO_ALLOWLIST_EMAILS.
 *   public — ordinary trial/paying user.
 *
 * ⚠️ tier "studio" is NOT "sees everything". That conflation is exactly the
 * bug this table exists to fix — see lib/vater/project-access.ts.
 *
 * 🔴 BEFORE GRANTING tier "studio" TO A THIRD ACCOUNT: read the
 * "KNOWN GAP — Phase 3" block at the top of lib/vater/job-ownership.ts.
 * Project data is properly owner-scoped, but inline Style-editor jobs (the
 * ones with no project behind them) are gated on studio tier alone, so every
 * studio-tier account can poll every other studio account's inline job. That
 * is harmless while the tier is the two-person env allowlist (Trey + Jared)
 * and becomes a real cross-tenant read the instant a beta invite gets
 * "studio". Grant "public" to beta invites unless someone has decided
 * otherwise, and close that gap first if "studio" is what they need.
 * ------------------------------------------------------------------ */

export type VaterTierName = "public" | "studio" | "owner";

export interface VaterAccess {
  tier: VaterTierName;
  /** Skip trial caps / card requirement / monthly spend ceiling. */
  unmetered: boolean;
  /** Where the grant came from — useful in logs when access looks wrong. */
  source: "db" | "env" | "none";
}

const TIER_RANK: Record<VaterTierName, number> = {
  public: 0,
  studio: 1,
  owner: 2,
};

function normalizeTier(value: string | null | undefined): VaterTierName {
  return value === "owner" || value === "studio" || value === "public"
    ? value
    : "public";
}

/** What the env allowlists alone would grant. Sync, no DB. */
export function resolveVaterTierFromEnv(email?: string | null): VaterAccess {
  if (isVaterAdminEmail(email)) {
    return { tier: "owner", unmetered: true, source: "env" };
  }
  if (isVaterStudioEmail(email)) {
    return { tier: "studio", unmetered: true, source: "env" };
  }
  return { tier: "public", unmetered: false, source: "none" };
}

/**
 * Effective access for a session: the HIGHER of the env grant and the
 * VaterAccount row. Union rather than override so that (a) revoking someone
 * needs both surfaces cleared — no silent lockout of the owner from a bad
 * row, and (b) a DB grant works with no env change.
 *
 * Pre-migration safe: code deploys on `git push main` but the Neon migration
 * is applied by hand, so VaterAccount may not exist yet. The probe (and the
 * P2021 catch behind it) makes that window degrade to the env allowlists —
 * exactly how access worked before the table existed — instead of throwing.
 *
 * prisma is imported lazily so this module stays importable from places that
 * only need the sync helpers without dragging the Prisma client in.
 */
export async function resolveVaterTier(
  userId?: string | null,
  email?: string | null,
): Promise<VaterAccess> {
  const fromEnv = resolveVaterTierFromEnv(email);
  if (!userId) {
    return fromEnv;
  }

  let row: { tier: string; unmetered: boolean } | null = null;
  try {
    const { hasVaterAccountTable } = await import("@/lib/vater/schema-probe");
    if (!(await hasVaterAccountTable())) {
      return fromEnv;
    }
    const { prisma } = await import("@/lib/prisma");
    row = await prisma.vaterAccount.findUnique({
      where: { userId },
      select: { tier: true, unmetered: true },
    });
    if (!row) {
      // Workspace TAB with no cloned row (lib/vater/workspaces.ts) — a tab
      // inherits its owner's tier, so read the root's row instead.
      const { rootUserIdFor } = await import("@/lib/vater/workspaces");
      const root = await rootUserIdFor(userId);
      if (root && root !== userId) {
        row = await prisma.vaterAccount.findUnique({
          where: { userId: root },
          select: { tier: true, unmetered: true },
        });
      }
    }
  } catch {
    // Table missing (pre-migration) or DB hiccup — fall back to env. Never
    // fail open past what env already grants.
    return fromEnv;
  }

  if (!row) {
    return fromEnv;
  }

  const dbTier = normalizeTier(row.tier);
  const winner =
    TIER_RANK[dbTier] >= TIER_RANK[fromEnv.tier] ? dbTier : fromEnv.tier;
  return {
    tier: winner,
    unmetered: row.unmetered || fromEnv.unmetered,
    source: TIER_RANK[dbTier] >= TIER_RANK[fromEnv.tier] ? "db" : fromEnv.source,
  };
}

/** Full studio feature set — env allowlist OR VaterAccount tier studio/owner. */
export async function isVaterStudioUser(
  userId?: string | null,
  email?: string | null,
): Promise<boolean> {
  const { tier } = await resolveVaterTier(userId, email);
  return tier === "studio" || tier === "owner";
}

/**
 * Owner — the ONLY tier that may read other tenants' projects.
 * Deliberately narrower than isVaterStudioUser.
 */
export async function isVaterOwnerUser(
  userId?: string | null,
  email?: string | null,
): Promise<boolean> {
  const { tier } = await resolveVaterTier(userId, email);
  return tier === "owner";
}

/** Unmetered billing — env allowlist OR VaterAccount.unmetered. */
export async function hasVaterUnmeteredAccess(
  userId?: string | null,
  email?: string | null,
): Promise<boolean> {
  const { unmetered } = await resolveVaterTier(userId, email);
  return unmetered;
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
