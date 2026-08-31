'use client';

/**
 * Connected-accounts tiles. Shared by Publishing and Socials.
 * Publishing passes `syncOnLoad` so it still POSTs /api/vater/social-accounts/sync.
 * Socials only reads — it does not kick a vendor sync on every visit.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, VBtn, ConfirmDialog } from '../../primitives';
import { SectionTitle, ErrorBar } from './AutopilotScreen';

export const SOCIAL_PLATFORMS = [
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'pinterest',
  'twitter',
  'linkedin',
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const PLATFORM_META: Record<SocialPlatform, { label: string; emoji: string }> = {
  youtube: { label: 'YouTube', emoji: '▶️' },
  tiktok: { label: 'TikTok', emoji: '🎵' },
  instagram: { label: 'Instagram', emoji: '📷' },
  facebook: { label: 'Facebook', emoji: '📘' },
  pinterest: { label: 'Pinterest', emoji: '📌' },
  twitter: { label: 'X', emoji: '🐦' },
  linkedin: { label: 'LinkedIn', emoji: '💼' },
};

export interface SocialAccount {
  platform: string;
  status: string;
  displayName?: string | null;
  username?: string | null;
  profileUrl?: string | null;
  avatarUrl?: string | null;
  provider?: string;
  connectedAt?: string;
}

export interface SocialAccountsResp {
  supported: readonly string[];
  accounts: SocialAccount[];
  byPlatform: Record<string, SocialAccount>;
}

export function ConnectionsPanel({
  syncOnLoad = false,
  showQueuePills = false,
  queueCounts,
  onAccounts,
}: {
  syncOnLoad?: boolean;
  showQueuePills?: boolean;
  queueCounts?: Record<string, { pending: number; posted: number; failed: number }>;
  onAccounts?: (data: SocialAccountsResp | null, vendorEnabled: boolean | null) => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [accounts, setAccounts] = React.useState<SocialAccountsResp | null>(null);
  const [accountsErr, setAccountsErr] = React.useState<string | null>(null);
  const [vendorEnabled, setVendorEnabled] = React.useState<boolean | null>(null);

  const loadAccounts = React.useCallback(async () => {
    let nextVendor: boolean | null = null;
    try {
      if (syncOnLoad) {
        try {
          const sync = await fetch('/api/vater/social-accounts/sync', {
            method: 'POST',
            cache: 'no-store',
          });
          if (sync.ok) {
            const sd = (await sync.json()) as { vendor?: string | null };
            nextVendor = Boolean(sd.vendor);
            setVendorEnabled(nextVendor);
          }
        } catch {
          /* list below still renders */
        }
      }
      const res = await fetch('/api/vater/social-accounts', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SocialAccountsResp;
      setAccounts(data);
      setAccountsErr(null);
      onAccounts?.(data, nextVendor);
    } catch (err) {
      setAccountsErr(err instanceof Error ? err.message : 'unknown');
      onAccounts?.(null, nextVendor);
    }
  }, [syncOnLoad, onAccounts]);

  React.useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  return (
    <VCard style={{ marginBottom: 16 }}>
      <SectionTitle
        icon="upload"
        title="Connected platforms"
        sub={
          vendorEnabled === false
            ? 'YouTube connects directly. Other platforms: download the MP4 and post through your scheduler.'
            : 'Each connection is to YOUR account — Jelly never posts without you pressing Publish. Every direct connection is $6/month per connected account (you can always download the MP4 and post it yourself for free).'
        }
      />
      {accountsErr && <ErrorBar message={`Could not load social accounts: ${accountsErr}`} />}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        {SOCIAL_PLATFORMS.map((p) => {
          const meta = PLATFORM_META[p];
          const acc = accounts?.byPlatform?.[p];
          const c = queueCounts?.[p] ?? { pending: 0, posted: 0, failed: 0 };
          const connected = Boolean(acc) && acc?.status !== 'failed';
          return (
            <div
              key={p}
              style={{
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{meta.label}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: connected ? JELLY_TOKENS.success : t.textDisabled,
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: t.textSecondary,
                  marginTop: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {connected
                  ? acc?.username
                    ? `@${acc.username.replace(/^@/, '')}`
                    : acc?.displayName ?? 'connected'
                  : p === 'youtube' || vendorEnabled !== false
                    ? 'not connected'
                    : 'via your scheduler'}
              </div>
              {vendorEnabled === false ? (
                <SchedulerHint platform={meta.label} />
              ) : (
                <VendorTileActions
                  platform={p}
                  label={meta.label}
                  connected={connected}
                  status={acc?.status}
                  onChanged={() => void loadAccounts()}
                />
              )}
              {showQueuePills && (
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Pill label="Pending" value={c.pending} color={JELLY_TOKENS.accent} />
                  <Pill label="Posted" value={c.posted} color={JELLY_TOKENS.success} />
                  <Pill label="Failed" value={c.failed} color={JELLY_TOKENS.error} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </VCard>
  );
}

function VendorTileActions({
  platform,
  label,
  connected,
  status,
  onChanged,
}: {
  platform: SocialPlatform;
  label: string;
  connected: boolean;
  status?: string;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [busy, setBusy] = React.useState(false);
  const [ask, setAsk] = React.useState<'disconnect' | 'connect' | null>(null);
  const needsReconnect = connected && status && status !== 'active';

  const runDisconnect = async (): Promise<void> => {
    setAsk(null);
    setBusy(true);
    try {
      await fetch(`/api/vater/social-accounts/${platform}`, { method: 'DELETE' });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const startOAuth = (force: boolean) => {
    window.location.href = `/api/vater/social-accounts/oauth/${platform}/start?return=publishing${force ? '&force=1' : ''}`;
  };

  const go = (force: boolean) => {
    if (!connected) {
      setAsk('connect');
      return;
    }
    startOAuth(force);
  };

  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
      <VBtn
        size="sm"
        variant={connected && !needsReconnect ? 'outlined' : 'primary'}
        onClick={() => go(Boolean(connected))}
      >
        {needsReconnect ? 'Reconnect' : connected ? 'Reconnect' : `Connect ${label}`}
      </VBtn>
      {connected && (
        <VBtn size="sm" variant="text" onClick={() => setAsk('disconnect')} disabled={busy}>
          {busy ? '…' : 'Disconnect'}
        </VBtn>
      )}
      <ConfirmDialog
        open={ask === 'disconnect'}
        title={`Disconnect ${label}?`}
        body="Jelly forgets the connection; nothing already posted is affected."
        confirmLabel="Disconnect"
        danger
        onConfirm={() => void runDisconnect()}
        onCancel={() => setAsk(null)}
      />
      <ConfirmDialog
        open={ask === 'connect'}
        title={`Connect ${label} — $6/month`}
        body={
          <>
            Connecting {label} directly costs $6/month per account (billed to
            your Jelly credit). Want more than one {label} account? Connect this
            one, then add another profile — each connected account is its own
            $6/month. Or skip the charge: download the MP4 and post it yourself.
          </>
        }
        confirmLabel="Connect — $6/month"
        onConfirm={() => {
          setAsk(null);
          startOAuth(false);
        }}
        onCancel={() => setAsk(null)}
      />
      {needsReconnect && (
        <span style={{ fontSize: 10, color: JELLY_TOKENS.error, alignSelf: 'center' }}>
          {status} — reconnect to fix
        </span>
      )}
      {!connected && (
        <span style={{ fontSize: 10, color: t.textDisabled, alignSelf: 'center' }}>
          posts to your own {label} account
        </span>
      )}
    </div>
  );
}

function SchedulerHint({ platform }: { platform: string }): React.ReactElement {
  const { t } = useTheme();
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: 11,
          fontFamily: JELLY_TOKENS.font,
          color: JELLY_TOKENS.brand,
          cursor: 'pointer',
        }}
      >
        {open ? 'Hide' : 'How?'}
      </button>
      {open && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            borderRadius: JELLY_TOKENS.radius.sm,
            background: t.card,
            border: `1px solid ${t.border}`,
            fontSize: 10,
            lineHeight: 1.6,
            color: t.textSecondary,
          }}
        >
          Jelly doesn&apos;t post to {platform} directly. Download the MP4 from
          the Library tab, then upload it to {platform} through the scheduler
          you already use — Repurpose, Postiz, or Blotato all take an MP4 and a
          caption.
        </div>
      )}
    </div>
  );
}

function Pill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}): React.ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, color }}>{label}</span>
    </div>
  );
}
