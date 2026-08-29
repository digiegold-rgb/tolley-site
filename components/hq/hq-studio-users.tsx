"use client";

/**
 * HqStudioUsers — the beta-tester roster on the /hq Must Complete tab.
 *
 * One place to answer the questions Jared actually asks during the invite-only
 * beta: who is in, what have they spent, what broke for them last, and who
 * needs a code. Sits next to HqVaterDue because both are "the studio, as a
 * business" rather than "the studio, as software".
 *
 * Actions:
 *   Mint invite  → POST /api/hq/vater-users { action: "mint-invite" } and the
 *                  link lands on the clipboard, ready to paste into an email.
 *   View as      → POST /api/admin/vater/view-as, then opens /animate in a new
 *                  tab as that customer, READ-ONLY.
 *   Tier /       → POST /api/hq/vater-users. Promoting past `public` needs an
 *   Unmetered      explicit confirm — see the cross-tenant note below.
 *
 * ⚠️ "View as" needs a NextAuth ADMIN SESSION, which is a different credential
 * from the /hq PIN this page runs on (impersonation works by rewriting that
 * session). If Jared isn't signed in at /login the button 401s, and the card
 * says exactly that instead of failing silently.
 */

import { useCallback, useEffect, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { readApiError } from "./types";

interface StudioUser {
  userId: string;
  email: string | null;
  tier: string;
  unmetered: boolean;
  balanceUsd: number | null;
  projectCount: number;
  lastProjectAt: string | null;
  lastProjectTitle: string | null;
  lastError: { message: string; at: string } | null;
  invited: boolean;
  createdAt: string | null;
  /** Listing Studio: front door + license (null until the origin migration lands). */
  origin?: "jelly" | "realestate" | null;
  licenseStatus?: "unverified" | "verified" | "manual_review" | "invalid" | null;
  licenseState?: string | null;
  licenseNumber?: string | null;
  /** Studio tabs folded under this human (lib/vater/workspaces.ts). */
  workspaces?: Array<{
    userId: string;
    name: string;
    balanceUsd: number | null;
    projectCount: number;
    lastProjectAt: string | null;
    archived: boolean;
  }>;
  usage?: UsageRollup;
}

interface TierSplit {
  byTier: Record<string, { actions: number; usd: number }>;
  actions: number;
  usd: number;
  animations: number;
}

interface UsageRollup {
  ready: boolean;
  d7: TierSplit;
  d30: TierSplit;
}

interface StudioInvite {
  id: string;
  code: string;
  display: string;
  link: string;
  email: string | null;
  usedCount: number;
  maxUses: number;
  expiresAt: string | null;
  spendable: boolean;
  note: string | null;
  createdAt: string;
}

interface Payload {
  users?: StudioUser[];
  invites?: StudioInvite[];
  inviteTableReady?: boolean;
  error?: string;
  message?: string;
}

/**
 * Our own test tenants, not customers.
 *
 * Specs and QA scripts seed a real User so the studio shell renders with a real
 * session, and they run against a Vercel PREVIEW that shares the PRODUCTION
 * database — so they land on this roster looking like beta testers. They are
 * folded into a "Tests" chip instead: out of the headline count, one click away
 * when a spec needs inspecting.
 *
 * Two shapes, both `@tolley.io`:
 *   throwaway  `e2e-<spec>@tolley.io`, `e2e-listing+<stamp>@tolley.io` — seeded
 *              and deleted per run (tests/e2e/_studio-auth.ts keeps exactly one
 *              per spec tag; prune leftovers with scripts/prune-e2e-users.mjs).
 *   fixture    `qa.*`, `audit-*`, `*.e2e.*` — long-lived personas that scripts
 *              hardcode (qa.walkthrough.0820 drives ~18 scripts/tmp-walkthrough-*,
 *              audit-public is AUDIT_ANIMATE_EMAIL). ⛔ Never prune these.
 */
function isTestAccount(u: StudioUser): boolean {
  const email = (u.email ?? "").toLowerCase();
  if (!email.endsWith("@tolley.io")) return false;
  const local = email.slice(0, -"@tolley.io".length);
  return /^(e2e-|qa[.-]|audit-)/.test(local) || local.includes(".e2e.");
}

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function money(value: number | null): string {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

/**
 * One tenant's charged consumption, split by GPU tier.
 *
 * This column exists because Modal's invoice cannot be split by user — its
 * billing rows carry no tenant field. If a `public` account's H100 minutes run
 * away, this is the only place it shows up before the bill arrives.
 *
 * `ready: false` renders "—", never "$0.00": no rows means nothing was
 * recorded, which is not the same claim as nothing was spent.
 */
function renderUsage(u: StudioUser): React.ReactNode {
  const usage = u.usage;
  if (!usage || !usage.ready) {
    return <span style={{ color: "var(--hq-muted)" }}>—</span>;
  }
  const line = (w: TierSplit) => {
    if (w.actions === 0) return "none";
    const tiers = Object.entries(w.byTier)
      .sort((a, b) => b[1].usd - a[1].usd)
      .map(([gpu, v]) => `${gpu} ×${v.actions}`)
      .join(", ");
    return `$${w.usd.toFixed(2)} · ${tiers}`;
  };
  // A tenant whose spend is concentrated in animation is the one worth a look:
  // it is the expensive action and the only one funded by purchased credit.
  const hot =
    usage.d7.animations > 0 &&
    u.balanceUsd !== null &&
    usage.d7.usd > u.balanceUsd;
  return (
    <div style={{ fontSize: 11, lineHeight: 1.5 }}>
      <div style={{ fontWeight: 600, color: hot ? "var(--hq-red, #b42318)" : undefined }}>
        7d {line(usage.d7)}
        {usage.d7.animations > 0 ? ` · ${usage.d7.animations} anim` : ""}
      </div>
      <div style={{ color: "var(--hq-muted)" }}>30d {line(usage.d30)}</div>
      {hot ? (
        <div style={{ color: "var(--hq-red, #b42318)" }}>
          spend exceeds balance — check
        </div>
      ) : null}
    </div>
  );
}

const CELL: React.CSSProperties = {
  padding: "7px 9px",
  verticalAlign: "top",
  borderTop: "1px solid var(--hq-border)",
};

const LICENSE_COLOR: Record<string, string> = {
  verified: "#0f766e",
  manual_review: "#b45309",
  invalid: "var(--hq-red, #b42318)",
  unverified: "var(--hq-muted)",
};

function renderOriginLicense(
  u: StudioUser,
  busy: boolean,
  setLicense: (user: StudioUser, status: "verified" | "invalid") => Promise<void>,
): React.ReactNode {
  if (u.origin === null || u.origin === undefined) {
    return <span style={{ color: "var(--hq-muted)" }} title="Run migration 20260827_vater_account_origin_license">—</span>;
  }
  const status = u.licenseStatus ?? "unverified";
  const lic = [u.licenseState, u.licenseNumber].filter(Boolean).join(" ");
  const btn = (label: string, next: "verified" | "invalid") => (
    <button
      type="button"
      onClick={() => void setLicense(u, next)}
      disabled={busy}
      style={{
        padding: "1px 6px",
        border: "1px solid var(--hq-border)",
        borderRadius: 5,
        fontSize: 10.5,
        cursor: "pointer",
        background: "#fff",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span
        style={{
          alignSelf: "flex-start",
          padding: "1px 7px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 700,
          background: u.origin === "realestate" ? "#0B1F3A" : "var(--hq-accent-soft, #f4f0ff)",
          color: u.origin === "realestate" ? "#F7F4EC" : "inherit",
        }}
      >
        {u.origin === "realestate" ? "Listing Studio" : "Jelly"}
      </span>
      {u.origin === "realestate" || status !== "unverified" || lic ? (
        <span style={{ fontSize: 11, color: LICENSE_COLOR[status] ?? "inherit" }} title={lic || "no license on file"}>
          {status.replace("_", " ")}
          {lic ? ` · ${lic}` : ""}
        </span>
      ) : null}
      {status === "manual_review" || (u.origin === "realestate" && lic && status !== "verified") ? (
        <div style={{ display: "flex", gap: 4 }}>
          {btn("Verify", "verified")}
          {btn("Reject", "invalid")}
        </div>
      ) : status === "verified" ? (
        <div>{btn("Revoke", "invalid")}</div>
      ) : null}
    </div>
  );
}

export function HqStudioUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<StudioUser[]>([]);
  const [invites, setInvites] = useState<StudioInvite[]>([]);
  const [inviteReady, setInviteReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  /** Origin chip filter: all | jelly | realestate (Listing Studio). */
  const [originFilter, setOriginFilter] = useState<"all" | "jelly" | "realestate">("all");
  /** Our own seeded tenants stay collapsed — the roster is for customers. */
  const [showTests, setShowTests] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/hq/vater-users", { cache: "no-store" });
      if (!r.ok) {
        // 401 = PIN not entered on this browser; the rest of /hq already
        // handles that, so this card just stays quiet.
        setUsers([]);
        return;
      }
      const data = (await r.json()) as Payload;
      setUsers(data.users ?? []);
      setInvites(data.invites ?? []);
      setInviteReady(data.inviteTableReady !== false);
    } catch {
      /* card renders empty rather than breaking the tab */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = useCallback(
    async (text: string, what: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast({ title: `${what} copied`, variant: "success" });
      } catch {
        toast({ title: `Copy blocked — ${text}`, variant: "error" });
      }
    },
    [toast],
  );

  const mintInvite = useCallback(async (send = false) => {
    setBusyId(send ? "mint-send" : "mint");
    try {
      const email = inviteEmail.trim();
      if (send && !email.includes("@")) {
        toast({ title: "Enter the email to send the invite to", variant: "error" });
        return;
      }
      const r = await fetch("/api/hq/vater-users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "mint-invite",
          count: 1,
          send,
          ...(email.includes("@") ? { email } : {}),
        }),
      });
      if (!r.ok) {
        toast({ title: await readApiError(r, "Invite NOT minted"), variant: "error" });
        return;
      }
      const data = (await r.json()) as {
        invites?: Array<{ display: string; link: string }>;
        sent?: boolean;
        sendError?: string | null;
      };
      const first = data.invites?.[0];
      if (send) {
        if (data.sent) {
          toast({ title: `Invite ${first?.display ?? ""} emailed to ${email}` });
        } else {
          toast({ title: `Minted but email FAILED (${data.sendError ?? "unknown"}) — link copied`, variant: "error" });
          if (first) await copy(first.link, `Invite ${first.display} link`);
        }
      } else if (first) {
        await copy(first.link, `Invite ${first.display} link`);
      }
      setInviteEmail("");
      void load();
    } catch {
      toast({ title: "Network error — invite NOT minted", variant: "error" });
    } finally {
      setBusyId(null);
    }
  }, [inviteEmail, copy, load, toast]);

  const viewAs = useCallback(
    async (user: StudioUser) => {
      setBusyId(user.userId);
      try {
        const r = await fetch("/api/admin/vater/view-as", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: user.userId, path: "/hq" }),
        });
        if (r.status === 401 || r.status === 403) {
          toast({
            title:
              "Sign in at /login with your admin email first — view-as rewrites that session, not the HQ PIN.",
            variant: "error",
          });
          return;
        }
        if (!r.ok) {
          toast({ title: await readApiError(r, "Could not start view-as"), variant: "error" });
          return;
        }
        toast({
          title: `Viewing as ${user.email ?? user.userId} — read-only, 2h`,
          variant: "success",
        });
        window.open("/animate", "_blank", "noopener,noreferrer");
      } catch {
        toast({ title: "Network error — view-as not started", variant: "error" });
      } finally {
        setBusyId(null);
      }
    },
    [toast],
  );

  const setUnmetered = useCallback(
    async (user: StudioUser) => {
      const next = !user.unmetered;
      setBusyId(user.userId);
      try {
        const r = await fetch("/api/hq/vater-users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "set-unmetered",
            userId: user.userId,
            unmetered: next,
          }),
        });
        if (!r.ok) {
          toast({ title: await readApiError(r, "Not changed"), variant: "error" });
          return;
        }
        toast({
          title: `${user.email ?? user.userId} is ${next ? "unmetered" : "metered"}`,
          variant: "success",
        });
        void load();
      } catch {
        toast({ title: "Network error — not changed", variant: "error" });
      } finally {
        setBusyId(null);
      }
    },
    [load, toast],
  );

  const setTier = useCallback(
    async (user: StudioUser, tier: string) => {
      if (tier === user.tier) return;
      /* Promoting past `public` is a cross-tenant read (inline style jobs are
       * shared across studio tier — job-ownership.ts KNOWN GAP). The API
       * refuses without an acknowledgement; this is where the human makes it. */
      let acknowledge = false;
      if (tier !== "public") {
        acknowledge = window.confirm(
          `Give ${user.email ?? user.userId} "${tier}" tier?\n\n` +
            "Studio/owner tier can read other accounts' inline style-editor jobs " +
            "(known gap in job-ownership.ts). Only do this for someone you trust " +
            "with other testers' work.",
        );
        if (!acknowledge) return;
      }

      setBusyId(user.userId);
      try {
        const r = await fetch("/api/hq/vater-users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "set-tier",
            userId: user.userId,
            tier,
            acknowledgeCrossTenant: acknowledge,
          }),
        });
        if (!r.ok) {
          toast({ title: await readApiError(r, "Tier NOT changed"), variant: "error" });
          return;
        }
        toast({ title: `${user.email ?? user.userId} → ${tier}`, variant: "success" });
        void load();
      } catch {
        toast({ title: "Network error — tier NOT changed", variant: "error" });
      } finally {
        setBusyId(null);
      }
    },
    [load, toast],
  );

  const setLicense = useCallback(
    async (user: StudioUser, status: "verified" | "invalid") => {
      const label = user.email ?? user.userId;
      const lic = [user.licenseState, user.licenseNumber].filter(Boolean).join(" ");
      if (!window.confirm(`${status === "verified" ? "VERIFY" : "REJECT"} the real-estate license for ${label}${lic ? ` (${lic})` : ""}?`)) return;
      setBusyId(user.userId);
      try {
        const r = await fetch("/api/hq/vater-users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "set-license", userId: user.userId, status }),
        });
        if (!r.ok) {
          toast({ title: await readApiError(r, "License NOT changed"), variant: "error" });
          return;
        }
        toast({ title: `${label} license → ${status}`, variant: "success" });
        void load();
      } catch {
        toast({ title: "Network error — license NOT changed", variant: "error" });
      } finally {
        setBusyId(null);
      }
    },
    [load, toast],
  );

  const liveInvites = invites.filter((i) => i.spendable);
  const humans = users.filter((u) => !isTestAccount(u));
  const testAccounts = users.filter(isTestAccount);
  const originCounts = {
    all: humans.length,
    jelly: humans.filter((u) => (u.origin ?? "jelly") === "jelly").length,
    realestate: humans.filter((u) => u.origin === "realestate").length,
  };
  const visibleUsers = humans.filter((u) => originFilter === "all" || (u.origin ?? "jelly") === originFilter);

  /** One roster row. Shared so the collapsed test block renders identically. */
  const renderRow = (u: StudioUser) => (
    <tr key={u.userId}>
      <td style={CELL}>
        <div style={{ fontWeight: 600 }}>{u.email ?? "(no email)"}</div>
        <div style={{ color: "var(--hq-muted)", fontSize: 11 }}>
          joined {shortDate(u.createdAt)}
          {u.invited ? " · invited" : ""}
          {u.unmetered ? " · unmetered" : ""}
        </div>
        {(u.workspaces ?? []).length > 0 ? (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
            {(u.workspaces ?? []).map((w) => (
              <div
                key={w.userId}
                style={{ fontSize: 11, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
                title={`Studio tab · ${w.userId}`}
              >
                <span style={{ color: "var(--hq-muted)" }}>↳ tab</span>
                <span style={{ fontWeight: 600, textDecoration: w.archived ? "line-through" : "none" }}>
                  {w.name}
                </span>
                <span style={{ color: "var(--hq-muted)" }}>
                  {money(w.balanceUsd)} · {w.projectCount} videos
                  {w.archived ? " · archived" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void viewAs({ ...u, userId: w.userId, email: `${u.email ?? u.userId} / ${w.name}` })}
                  disabled={busyId === w.userId}
                  title="Open /animate inside this tab, read-only"
                  style={{
                    padding: "1px 6px",
                    border: "1px solid var(--hq-border)",
                    borderRadius: 5,
                    fontSize: 10.5,
                    cursor: "pointer",
                    background: "#fff",
                  }}
                >
                  View as
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </td>
      <td style={CELL}>
        <select
          value={u.tier}
          onChange={(e) => void setTier(u, e.target.value)}
          disabled={busyId === u.userId}
          aria-label={`Tier for ${u.email ?? u.userId}`}
          style={{
            padding: "3px 6px",
            border: "1px solid var(--hq-border)",
            borderRadius: 6,
            fontSize: 11,
            background: "#fff",
          }}
        >
          <option value="public">public</option>
          <option value="studio">studio</option>
          <option value="owner">owner</option>
        </select>
      </td>
      <td style={CELL}>{renderOriginLicense(u, busyId === u.userId, setLicense)}</td>
      <td style={CELL}>{money(u.balanceUsd)}</td>
      <td style={CELL}>{u.projectCount}</td>
      <td style={CELL}>{renderUsage(u)}</td>
      <td style={CELL}>
        <div>{u.lastProjectTitle ?? "—"}</div>
        <div style={{ color: "var(--hq-muted)", fontSize: 11 }}>
          {shortDate(u.lastProjectAt)}
        </div>
      </td>
      <td style={{ ...CELL, maxWidth: 220 }}>
        {u.lastError ? (
          <span style={{ color: "var(--hq-red, #b42318)" }}>
            {u.lastError.message.slice(0, 120)}
            <span style={{ color: "var(--hq-muted)" }}>
              {" "}
              ({shortDate(u.lastError.at)})
            </span>
          </span>
        ) : (
          <span style={{ color: "var(--hq-muted)" }}>none</span>
        )}
      </td>
      <td style={CELL}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            type="button"
            onClick={() => void viewAs(u)}
            disabled={busyId === u.userId}
            title="Open /animate as this customer, read-only, for 2 hours"
            style={{
              padding: "3px 8px",
              border: "1px solid var(--hq-border)",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              background: "#fff",
            }}
          >
            View as
          </button>
          <button
            type="button"
            onClick={() => void setUnmetered(u)}
            disabled={busyId === u.userId}
            title="Skip trial caps / card requirement for this account"
            style={{
              padding: "3px 8px",
              border: "1px solid var(--hq-border)",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              background: u.unmetered ? "var(--hq-accent-soft, #f4f0ff)" : "#fff",
            }}
          >
            {u.unmetered ? "Metered" : "Unmetered"}
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div
      style={{
        padding: "10px 14px",
        marginBottom: 14,
        border: "1px solid var(--hq-border)",
        borderRadius: 10,
        background: "#fff",
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <strong style={{ fontSize: 14 }}>🎬 Studio users</strong>
        <span style={{ color: "var(--hq-muted)" }}>
          {loading ? "loading…" : `${humans.length} account${humans.length === 1 ? "" : "s"}`}
          {" · "}
          {liveInvites.length} unused invite{liveInvites.length === 1 ? "" : "s"}
        </span>

        <div style={{ flex: 1 }} />

        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          placeholder="lock to email (optional)"
          aria-label="Lock the new invite to an email address"
          style={{
            padding: "5px 8px",
            border: "1px solid var(--hq-border)",
            borderRadius: 8,
            fontSize: 12,
            width: 190,
          }}
        />
        <button
          type="button"
          onClick={() => void mintInvite(true)}
          disabled={busyId === "mint-send" || !inviteReady || !inviteEmail.includes("@")}
          title={
            inviteReady
              ? "Mint an email-locked code AND email them the signup link (closes the invite-request item)"
              : "Run migration 20260815_beta_invites first"
          }
          style={{
            padding: "5px 12px",
            border: "1px solid var(--hq-border)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: inviteReady && inviteEmail.includes("@") ? "pointer" : "not-allowed",
            background: "#0f766e",
            color: "#fff",
          }}
        >
          {busyId === "mint-send" ? "Sending…" : "✉ Mint + email invite"}
        </button>
        <button
          type="button"
          onClick={() => void mintInvite(false)}
          disabled={busyId === "mint" || !inviteReady}
          title={
            inviteReady
              ? "Mint a code and copy its signup link"
              : "Run migration 20260815_beta_invites first"
          }
          style={{
            padding: "5px 12px",
            border: "1px solid var(--hq-border)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: inviteReady ? "pointer" : "not-allowed",
            background: "var(--hq-accent-soft, #f4f0ff)",
          }}
        >
          {busyId === "mint" ? "Minting…" : "+ Mint invite"}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            padding: "5px 10px",
            border: "1px solid var(--hq-border)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: "#fff",
          }}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="Filter by product">
          {(
            [
              ["all", "All"],
              ["jelly", "Jelly"],
              ["realestate", "Listing Studio"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={originFilter === key}
              onClick={() => setOriginFilter(key)}
              style={{
                padding: "3px 10px",
                border: "1px solid var(--hq-border)",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                background: originFilter === key ? "var(--hq-accent-soft, #f4f0ff)" : "#fff",
              }}
            >
              {label} · {originCounts[key]}
            </button>
          ))}
        </div>
      )}

      {!inviteReady && (
        <div style={{ marginTop: 8, color: "var(--hq-red, #b42318)", fontSize: 12 }}>
          Invite table not migrated yet — run{" "}
          <code>prisma/migrations/20260815_beta_invites/migration.sql</code>. Signup
          stays open until it lands.
        </div>
      )}

      {open && (
        <div style={{ marginTop: 10, overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 780, borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--hq-muted)" }}>
                <th style={{ padding: "6px 9px" }}>Email</th>
                <th style={{ padding: "6px 9px" }}>Tier</th>
                <th style={{ padding: "6px 9px" }} title="Which front door (VaterAccount.origin) and real-estate license state. Verify/Reject resolves a manual review.">
                  Origin / License
                </th>
                <th style={{ padding: "6px 9px" }}>Balance</th>
                <th style={{ padding: "6px 9px" }}>Videos</th>
                <th style={{ padding: "6px 9px" }} title="Charged usage from VaterUsage, split by GPU tier. Modal's invoice cannot be split by user — this is where per-tenant consumption is visible.">
                  GPU usage 7d / 30d
                </th>
                <th style={{ padding: "6px 9px" }}>Last project</th>
                <th style={{ padding: "6px 9px" }}>Last error</th>
                <th style={{ padding: "6px 9px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 && !loading ? (
                <tr>
                  <td style={{ ...CELL, color: "var(--hq-muted)" }} colSpan={9}>
                    No studio accounts yet. Mint an invite to get the first tester in.
                  </td>
                </tr>
              ) : (
                visibleUsers.map(renderRow)
              )}
              {testAccounts.length > 0 && (
                <>
                  <tr>
                    <td colSpan={9} style={{ ...CELL, background: "var(--hq-soft, #fafafa)" }}>
                      <button
                        type="button"
                        onClick={() => setShowTests((v) => !v)}
                        aria-expanded={showTests}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "none",
                          color: "var(--hq-muted)",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {showTests ? "▾" : "▸"} Test accounts · {testAccounts.length}
                      </button>
                      <span style={{ marginLeft: 8, color: "var(--hq-muted)", fontSize: 11 }}>
                        Playwright seeds + QA fixtures — not customers
                      </span>
                    </td>
                  </tr>
                  {showTests ? testAccounts.map(renderRow) : null}
                </>
              )}
            </tbody>
          </table>

          {liveInvites.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Unused invites</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {liveInvites.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => void copy(i.link, `Invite ${i.display} link`)}
                    title={`Copy signup link${i.email ? ` (locked to ${i.email})` : ""}`}
                    style={{
                      padding: "4px 10px",
                      border: "1px solid var(--hq-border)",
                      borderRadius: 999,
                      fontSize: 11,
                      fontFamily: "monospace",
                      cursor: "pointer",
                      background: "#fff",
                    }}
                  >
                    {i.display}
                    {i.email ? ` → ${i.email}` : ""} · {i.maxUses - i.usedCount} left
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
