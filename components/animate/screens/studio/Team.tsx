'use client';

/* Team — seats on a shared Jelly Studio account.
 *
 * What a seat buys: teammates SEE each other's projects, and editors can work
 * on them. What it does not buy: a shared wallet. Credits stay on the account
 * that bought them, and a render is always billed to whoever owns the project.
 * The screen says so out loud, because "we share a plan" is the assumption
 * every reader arrives with and the one that would cost somebody money.
 *
 * Inviting mints an ordinary beta invite code tied to this org — there is no
 * second door into the studio. The invitee redeems it through normal signup
 * and appears here as a member. Until they do, they show as pending, so
 * "I invited them and nothing happened" is visible rather than mysterious.
 *
 * No email is sent from this screen (feedback_no_autonomous_sends): the owner
 * copies the link and sends it themselves.
 *
 * Server contract: GET/POST /api/vater/me/team, PATCH/DELETE
 * /api/vater/me/team/{userId}.
 */

import * as React from 'react';

import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, VInput } from '../../primitives';

type Role = 'owner' | 'editor' | 'viewer';

interface Member {
  userId: string;
  email: string | null;
  name: string | null;
  role: Role;
  joinedAt: string;
  isYou: boolean;
}

interface Pending {
  id: string;
  email: string | null;
  code: string;
  link: string;
  createdAt: string;
}

interface TeamPayload {
  org: { id: string; name: string; isOwner: boolean } | null;
  role: Role | null;
  members: Member[];
  pending: Pending[];
  maxSeats: number;
}

const ROLE_NOTE: Record<Role, string> = {
  owner: 'Pays, invites, full access',
  editor: 'Can open and change any team project',
  viewer: 'Can open team projects, cannot change them',
};

export function Team(): React.ReactElement {
  const { t } = useTheme();
  const [data, setData] = React.useState<TeamPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notReady, setNotReady] = React.useState(false);

  const [teamName, setTeamName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/vater/me/team', { cache: 'no-store' });
      if (r.status === 503) {
        setNotReady(true);
        return;
      }
      if (!r.ok) {
        setError(
          r.status === 401
            ? 'Your session expired — sign in again.'
            : 'Could not load your team.',
        );
        return;
      }
      setNotReady(false);
      setData((await r.json()) as TeamPayload);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const post = React.useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch('/api/vater/me/team', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = (await r.json().catch(() => ({}))) as { message?: string };
        if (!r.ok) {
          setError(payload.message || 'That did not work.');
          return false;
        }
        await load();
        return true;
      } catch {
        setError('Could not reach the server.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const changeRole = React.useCallback(
    async (userId: string, role: Role) => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch(`/api/vater/me/team/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role }),
        });
        if (!r.ok) {
          const p = (await r.json().catch(() => ({}))) as { message?: string };
          setError(p.message || 'Could not change that role.');
          return;
        }
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const removeMember = React.useCallback(
    async (userId: string) => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch(`/api/vater/me/team/${userId}`, { method: 'DELETE' });
        if (!r.ok) {
          const p = (await r.json().catch(() => ({}))) as { message?: string };
          setError(p.message || 'Could not remove that person.');
          return;
        }
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const copy = React.useCallback(async (value: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(tag);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Your browser blocked clipboard access — select and copy manually.');
    }
  }, []);

  if (notReady) {
    return (
      <Banner tone="warn">
        Team seats are deployed but the database migration has not been applied
        yet. This screen works as soon as it runs.
      </Banner>
    );
  }

  if (loading && !data) {
    return <div style={{ fontSize: 13, color: t.textSecondary }}>Loading…</div>;
  }

  // ── No team yet ─────────────────────────────────────────────────────────
  if (!data?.org) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && <Banner tone="error">{error}</Banner>}
        <VCard variant="flat">
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            Work with other people
          </div>
          <div
            style={{
              fontSize: 13,
              color: t.textSecondary,
              marginTop: 6,
              maxWidth: 560,
            }}
          >
            Create a team and everyone you invite can see the team&rsquo;s videos —
            editors can work on them, viewers can only watch. Credits are not
            shared: each person&rsquo;s renders are billed to their own balance.
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-end',
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            <VInput
              label="Team name"
              placeholder="Whitfield Media"
              value={teamName}
              onChange={setTeamName}
              maxLength={120}
              style={{ flex: '1 1 260px' }}
            />
            <VBtn
              disabled={busy || !teamName.trim()}
              onClick={() => void post({ name: teamName })}
            >
              {busy ? 'Creating…' : 'Create team'}
            </VBtn>
          </div>
        </VCard>
      </div>
    );
  }

  const isOwner = data.org.isOwner;
  const used = data.members.length + data.pending.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {error && <Banner tone="error">{error}</Banner>}

      <VCard variant="flat">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'baseline',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>
            {data.org.name}
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary }}>
            {used} of {data.maxSeats} seats used · you are{' '}
            <strong style={{ color: t.text }}>{data.role}</strong>
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.textSecondary,
            marginTop: 8,
            maxWidth: 620,
          }}
        >
          Seats share visibility, not money. Every render is billed to the
          balance of whoever owns that project.
        </div>
      </VCard>

      {/* ── Invite ──────────────────────────────────────────────────────── */}
      {isOwner && (
        <VCard variant="flat">
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            Invite someone
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4 }}>
            We generate an invite link. Send it yourself — we never email your
            teammates on your behalf.
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-end',
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            <VInput
              label="Email address"
              placeholder="teammate@example.com"
              value={inviteEmail}
              onChange={setInviteEmail}
              maxLength={200}
              style={{ flex: '1 1 280px' }}
            />
            <VBtn
              disabled={busy || !inviteEmail.includes('@')}
              onClick={async () => {
                const ok = await post({ email: inviteEmail });
                if (ok) setInviteEmail('');
              }}
            >
              {busy ? 'Working…' : 'Create invite'}
            </VBtn>
          </div>
        </VCard>
      )}

      {/* ── Members ─────────────────────────────────────────────────────── */}
      <VCard variant="flat">
        <div style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 12 }}>
          Members
        </div>
        {data.members.map((m) => (
          <div
            key={m.userId}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              flexWrap: 'wrap',
              padding: '12px 0',
              borderTop: `1px solid ${t.border}`,
            }}
          >
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                {m.name || m.email || m.userId}
                {m.isYou && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: t.textSecondary }}>
                    you
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                {m.email ?? '—'} · {ROLE_NOTE[m.role]}
              </div>
            </div>

            {isOwner && m.role !== 'owner' ? (
              <>
                <select
                  value={m.role}
                  disabled={busy}
                  onChange={(e) => void changeRole(m.userId, e.target.value as Role)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: JELLY_TOKENS.radius.sm,
                    border: `1px solid ${t.border}`,
                    background: t.card,
                    color: t.text,
                    fontSize: 13,
                  }}
                >
                  <option value="editor">editor</option>
                  <option value="viewer">viewer</option>
                </select>
                <VBtn
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void removeMember(m.userId)}
                >
                  Remove
                </VBtn>
              </>
            ) : (
              <div style={{ fontSize: 13, color: t.textSecondary }}>{m.role}</div>
            )}
          </div>
        ))}
      </VCard>

      {/* ── Pending invites ─────────────────────────────────────────────── */}
      {data.pending.length > 0 && (
        <VCard variant="flat">
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>
            Waiting to join
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4, marginBottom: 12 }}>
            These people have an invite but have not signed up yet. They join the
            team automatically once they do.
          </div>
          {data.pending.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '10px 0',
                borderTop: `1px solid ${t.border}`,
              }}
            >
              <div style={{ flex: '1 1 200px', fontSize: 14, color: t.text }}>
                {p.email ?? p.code}
              </div>
              <VBtn size="sm" variant="ghost" onClick={() => void copy(p.link, p.id)}>
                {copied === p.id ? 'Copied' : 'Copy invite link'}
              </VBtn>
            </div>
          ))}
        </VCard>
      )}
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: 'warn' | 'error';
  children: React.ReactNode;
}): React.ReactElement {
  const color = tone === 'error' ? JELLY_TOKENS.error : JELLY_TOKENS.warning;
  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${color}`,
        background:
          tone === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)',
        color,
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
