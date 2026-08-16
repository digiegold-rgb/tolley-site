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

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function money(value: number | null): string {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

const CELL: React.CSSProperties = {
  padding: "7px 9px",
  verticalAlign: "top",
  borderTop: "1px solid var(--hq-border)",
};

export function HqStudioUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState<StudioUser[]>([]);
  const [invites, setInvites] = useState<StudioInvite[]>([]);
  const [inviteReady, setInviteReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

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

  const liveInvites = invites.filter((i) => i.spendable);

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
          {loading ? "loading…" : `${users.length} account${users.length === 1 ? "" : "s"}`}
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
                <th style={{ padding: "6px 9px" }}>Balance</th>
                <th style={{ padding: "6px 9px" }}>Videos</th>
                <th style={{ padding: "6px 9px" }}>Last project</th>
                <th style={{ padding: "6px 9px" }}>Last error</th>
                <th style={{ padding: "6px 9px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && !loading ? (
                <tr>
                  <td style={{ ...CELL, color: "var(--hq-muted)" }} colSpan={7}>
                    No studio accounts yet. Mint an invite to get the first tester in.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.userId}>
                    <td style={CELL}>
                      <div style={{ fontWeight: 600 }}>{u.email ?? "(no email)"}</div>
                      <div style={{ color: "var(--hq-muted)", fontSize: 11 }}>
                        joined {shortDate(u.createdAt)}
                        {u.invited ? " · invited" : ""}
                        {u.unmetered ? " · unmetered" : ""}
                      </div>
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
                    <td style={CELL}>{money(u.balanceUsd)}</td>
                    <td style={CELL}>{u.projectCount}</td>
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
                ))
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
