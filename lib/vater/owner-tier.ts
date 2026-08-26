/**
 * lib/vater/owner-tier.ts
 *
 * Per-tenant fields the DGX autopilot needs on every job kickoff
 * (content-autopilot 9cbe9a6): `/vater/run-creation` and
 * `/vater/animate-all-scenes` accept `ownerId`, `ownerTier` and an optional
 * `maxWords`. `ownerTier: "owner"` is exempt from the concurrency cap;
 * anything else is capped and over-cap jobs park as status "queued", phase
 * "queued (#N in line)".
 *
 * Two entry points because the callers differ:
 *   - route handlers already hold the session → `ownerFieldsForSession`
 *     (no DB hit)
 *   - lib/vater/script-gate.ts + course-pipeline only hold a project row →
 *     `ownerFieldsForProject` (one User lookup)
 *
 * NOTE (2026-08-15): the tenancy agent is landing async
 * `resolveVaterTier(userId, email)` in lib/admin-auth.ts returning
 * public|studio|owner off a new VaterAccount table. This module deliberately
 * stays a thin isVaterAdminEmail wrapper so the two don't collide; once
 * VaterAccount is live, `ownerTierFor*` should delegate to resolveVaterTier
 * and map studio|public → "beta".
 *
 * 2026-08-17: these fields also carry `ownerLane`, which decides WHICH MODAL
 * APP the render dispatches to and therefore whose invoice line it lands on.
 * Only the async entry points can produce it. A spending path that calls the
 * sync `ownerFieldsForSession` sends no lane, and the DGX then falls back to
 * ownerTier — which is wrong for the studio accounts. See `laneFor`.
 */
import "server-only";
import { isVaterAdminEmail, hasVaterUnmeteredAccess } from "@/lib/admin-auth";
import { scriptCapFor } from "./billing/script-cap";
import { BETA_MAX_WORDS } from "./script-limits";
import { resolveTenantIdentity } from "./tenant-identity";

export type OwnerTier = "owner" | "beta";

/**
 * Which Modal app family this render's GPU work dispatches to
 * (content-autopilot/vater_lane.py). "vater" = house lane, "jelly" = customer.
 */
export type OwnerLane = "vater" | "jelly";

/** Script length ceiling for a non-owner render with no purchased credit.
 *  Defined in `script-limits.ts` so the browser can quote the same number.
 *  ⚠️ This is the FLOOR, not the answer: an account with purchased balance
 *  renders up to PAID_MAX_WORDS. Use the async entry points below (or
 *  lib/vater/billing/script-cap.ts directly) rather than this constant. */
export const NON_OWNER_MAX_WORDS = BETA_MAX_WORDS;

export interface OwnerFields {
  ownerId: string;
  /** The real login behind `ownerId` when it is a workspace TAB (hidden User
   *  row — lib/vater/workspaces.ts). The DGX uses it for the house ElevenLabs
   *  key, per-human admission, and per-human cost roll-ups; everything
   *  data-shaped (characters, voices, rules, ledger attribution) stays on
   *  `ownerId`. Omitted when ownerId IS the login. */
  rootOwnerId?: string;
  ownerTier: OwnerTier;
  /** Undefined for the owner — the DGX treats a missing cap as no cap. */
  maxWords?: number;
  /** Set only by the async entry points — see `laneFor` below. */
  ownerLane?: OwnerLane;
}

/**
 * Which Modal invoice line this render's GPU-seconds belong on.
 *
 * ⚠️ Deliberately NOT derived from `ownerTier`. The two answer different
 * questions and they disagree for the one account that matters most:
 *
 *   ownerTier — a FAIRNESS question ("exempt from the concurrency cap and the
 *     beta word cap?"), keyed on VATER_ADMIN_ALLOWLIST_EMAILS.
 *   ownerLane — a BILLING question ("does a customer pay for this render, or
 *     does the house?"), keyed on unmetered access.
 *
 * Trey is on VATER_STUDIO_ALLOWLIST_EMAILS but NOT the admin allowlist, so his
 * ownerTier is "beta" — mapping the lane off the tier would have billed every
 * one of his own videos to the customer lane, which is precisely the mix-up
 * the split exists to prevent. `unmetered` is the honest signal: it is already
 * what check-budget.ts uses to decide nobody's credits are charged, and a
 * render nobody's credits pay for is house spend by definition.
 */
async function laneFor(
  userId: string,
  email: string | null | undefined,
  /** True when `email` is known to belong to `userId`. When false the email
   *  is looked up instead of trusted — see below. */
  emailBelongsToOwner = true,
): Promise<OwnerLane> {
  if (!userId) return "vater"; // no tenant = internal harness = house
  let ownerEmail = emailBelongsToOwner ? email ?? null : null;
  if (!ownerEmail) {
    // The caller's session email may belong to someone else entirely (support
    // acting on a customer's project). Handing THAT to the unmetered check
    // would put the customer's render on the house lane, so resolve the
    // tenant's own email rather than guessing. VaterAccount alone would
    // usually answer this, but the env allowlists are still a live bootstrap
    // path for an account that has no row yet. Goes through tenant-identity
    // so a workspace TAB (email NULL) answers with its owner's email.
    ownerEmail = (await resolveTenantIdentity(userId)).email;
  }
  return (await hasVaterUnmeteredAccess(userId, ownerEmail)) ? "vater" : "jelly";
}

function build(
  ownerId: string,
  email: string | null | undefined,
  rootOwnerId?: string | null,
): OwnerFields {
  const ownerTier: OwnerTier = isVaterAdminEmail(email) ? "owner" : "beta";
  return {
    ownerId,
    ...(rootOwnerId && rootOwnerId !== ownerId ? { rootOwnerId } : {}),
    ownerTier,
    ...(ownerTier === "owner" ? {} : { maxWords: NON_OWNER_MAX_WORDS }),
  };
}

type OwnerSession = {
  user?: { id?: string | null; email?: string | null } | null;
  /** Present inside a workspace tab — see types/next-auth.d.ts. */
  workspace?: { id: string; rootUserId: string } | null;
};

/**
 * For route handlers. `projectUserId` wins when present (the job belongs to
 * the project's tenant, not whoever clicked), falling back to the session.
 */
export function ownerFieldsForSession(
  session: OwnerSession,
  projectUserId?: string | null,
): OwnerFields {
  const sessionUserId = session?.user?.id ?? "";
  const ownerId = projectUserId ?? sessionUserId;
  // The sync form can only know the root for the SESSION's own tab; a
  // support session acting on someone else's project sends no root and the
  // DGX falls back to ownerId, which is today's behaviour.
  const root = ownerId === sessionUserId ? session?.workspace?.rootUserId : undefined;
  return build(ownerId, session?.user?.email, root);
}

/**
 * The async form of `ownerFieldsForSession`, and the one any path that sends
 * a SCRIPT to the DGX should use.
 *
 * `ownerFieldsForSession` cannot answer "how long a script may this account
 * render" — that depends on their purchased balance, which is a query. The
 * sync version stays for the callers that only need ownerId/ownerTier (the
 * concurrency cap), so nothing that does not care pays for a DB round trip.
 */
export async function ownerFieldsForSessionWithCap(
  session: OwnerSession,
  projectUserId?: string | null,
): Promise<OwnerFields> {
  const base = await withRoot(ownerFieldsForSession(session, projectUserId));
  const sessionUserId = session?.user?.id ?? "";
  return withCap(
    base,
    session?.user?.email,
    base.ownerId === sessionUserId,
  );
}

/**
 * Fill in `rootOwnerId` for a tenant the session did not tell us about (a
 * project owned by a workspace tab, opened by a team seat or support). One
 * memoised lookup; a no-op when the fields already carry it or the tenant is
 * a plain login.
 */
async function withRoot(fields: OwnerFields): Promise<OwnerFields> {
  if (!fields.ownerId || fields.rootOwnerId) return fields;
  const ident = await resolveTenantIdentity(fields.ownerId);
  return ident.isWorkspace ? { ...fields, rootOwnerId: ident.rootUserId } : fields;
}

/**
 * `ownerFieldsForSession` plus the Modal lane, and nothing else.
 *
 * Every non-script path that makes the DGX spend — animate-scene,
 * animate-all, regen, compose, make-short — must use THIS rather than the
 * sync form. The sync form cannot resolve a lane (unmetered status is a
 * query), and a request that arrives without `ownerLane` falls back to
 * `ownerTier`, which is wrong for exactly the accounts that matter: see the
 * warning on `laneFor`.
 *
 * Distinct from `ownerFieldsForSessionWithCap` because the script word cap
 * costs a second query these callers have no use for — none of them send a
 * script.
 */
export async function ownerFieldsForSessionWithLane(
  session: OwnerSession,
  projectUserId?: string | null,
): Promise<OwnerFields> {
  const base = await withRoot(ownerFieldsForSession(session, projectUserId));
  const sessionUserId = session?.user?.id ?? "";
  return {
    ...base,
    ownerLane: await laneFor(
      base.ownerId,
      session?.user?.email,
      base.ownerId === sessionUserId,
    ),
  };
}

/**
 * For lib-side kickoffs that only have the project row (script-gate,
 * course-pipeline). A null `userId` is a legacy pre-multi-tenancy project,
 * which is the owner's by definition.
 */
export async function ownerFieldsForProject(
  projectUserId: string | null,
): Promise<OwnerFields> {
  if (!projectUserId) {
    return { ownerId: "", ownerTier: "owner", ownerLane: "vater" };
  }
  // tenant-identity, not a bare User lookup: a workspace tab has email NULL
  // and would otherwise land on the customer lane at beta tier.
  const ident = await resolveTenantIdentity(projectUserId);
  return withCap(build(projectUserId, ident.email, ident.rootUserId), ident.email);
}

/**
 * Replace the placeholder beta cap with this account's real one.
 *
 * The owner keeps NO maxWords key at all (the DGX reads a missing cap as
 * uncapped), so this only ever touches the non-owner branch.
 */
async function withCap(
  fields: OwnerFields,
  email: string | null | undefined,
  /** See `laneFor`. `ownerFieldsForProject` looks the email up from the
   *  project's own user, so it passes true; a session-based caller passes
   *  true only when the session IS the tenant. */
  emailBelongsToOwner = true,
): Promise<OwnerFields> {
  const ownerLane = await laneFor(fields.ownerId, email, emailBelongsToOwner);
  fields = { ...fields, ownerLane };
  if (fields.ownerTier === "owner") return fields;
  const cap = await scriptCapFor(fields.ownerId, email ?? null);
  if (cap.maxWords === undefined) {
    // Uncapped: the key must be ABSENT, not undefined — it is JSON.stringify'd
    // into the run-creation body, and `maxWords: undefined` and no key at all
    // happen to serialise the same but only one of them says so.
    return {
      ownerId: fields.ownerId,
      ownerTier: fields.ownerTier,
      ownerLane: fields.ownerLane,
    };
  }
  return { ...fields, maxWords: cap.maxWords };
}
