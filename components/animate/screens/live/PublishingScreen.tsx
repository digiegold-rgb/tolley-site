'use client';

/* PublishingScreen — LIVE.
 *
 * Phase 2 wiring for the Publishing tab. Lifts the patterns from
 * components/vater/youtube-share-modal.tsx into a full-screen multi-platform
 * publishing queue.
 *
 *   - Reads the connected platforms from /api/vater/social-accounts.
 *   - Reads the cross-platform autopilot publish queue from /api/content/posts
 *     (the existing cross-cutting publisher). Requires a sync-secret token —
 *     surfaced via NEXT_PUBLIC_AUTOPILOT_KEY when present, else falls back to
 *     a polite empty state.
 *   - Filters: pending / posted / failed.
 *   - Per-row Retry action that re-POSTs the row to /api/content/posts (the
 *     publisher dedupes on (subscriberId, scheduledAt, platform) so a retry
 *     of an already-posted row is a no-op).
 *   - Per-platform post counts at the top.
 *
 * Stripe webhook URL `/api/account/webhooks/stripe` is intentionally NOT
 * touched here (risk #6) — there's no rewrite, no router push to it, no
 * proxy. We only call /api/content/posts and /api/vater/social-accounts.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, VBtn } from '../../primitives';
import { SectionTitle, EmptyState, ErrorBar, SkeletonRows } from './AutopilotScreen';

const SUPPORTED_PLATFORMS = [
  'youtube',
  'tiktok',
  'instagram',
  'facebook',
  'pinterest',
  'twitter',
  'linkedin',
] as const;
type Platform = (typeof SUPPORTED_PLATFORMS)[number];

const PLATFORM_META: Record<
  Platform,
  { label: string; emoji: string; tint: string }
> = {
  youtube: { label: 'YouTube', emoji: '▶️', tint: '#EF4444' },
  tiktok: { label: 'TikTok', emoji: '🎵', tint: '#D946EF' },
  instagram: { label: 'Instagram', emoji: '📷', tint: '#EC4899' },
  facebook: { label: 'Facebook', emoji: '📘', tint: '#3B82F6' },
  pinterest: { label: 'Pinterest', emoji: '📌', tint: '#DC2626' },
  twitter: { label: 'X', emoji: '🐦', tint: '#71717A' },
  linkedin: { label: 'LinkedIn', emoji: '💼', tint: '#0EA5E9' },
};

type StatusFilter = 'all' | 'pending' | 'posted' | 'failed';

interface ContentPost {
  id: string;
  subscriberId: string;
  platform: string;
  contentType: string;
  body: string;
  status: 'pending' | 'scheduled' | 'posted' | 'failed' | string;
  scheduledAt?: string | null;
  postedAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  mediaUrls?: string[];
}

interface SocialAccount {
  platform: string;
  status: string;
  displayName?: string | null;
  connectedAt?: string;
}

interface SocialAccountsResp {
  supported: readonly string[];
  accounts: SocialAccount[];
  byPlatform: Record<string, SocialAccount>;
}

const POSTS_AUTH_KEY =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_AUTOPILOT_KEY : undefined;

export function PublishingScreen(): React.ReactElement {
  const { t } = useTheme();
  const [posts, setPosts] = React.useState<ContentPost[]>([]);
  const [postsErr, setPostsErr] = React.useState<string | null>(null);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [accounts, setAccounts] = React.useState<SocialAccountsResp | null>(null);
  const [accountsErr, setAccountsErr] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<StatusFilter>('pending');
  const [retryingId, setRetryingId] = React.useState<string | null>(null);

  const loadPosts = React.useCallback(async () => {
    setPostsLoading(true);
    try {
      const url = new URL('/api/content/posts', window.location.origin);
      url.searchParams.set('limit', '100');
      if (POSTS_AUTH_KEY) url.searchParams.set('key', POSTS_AUTH_KEY);
      const res = await fetch(url.toString().replace(window.location.origin, ''), {
        cache: 'no-store',
      });
      if (res.status === 401) {
        throw new Error('Publishing queue unavailable — contact admin.');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { posts?: ContentPost[] };
      setPosts(data.posts ?? []);
      setPostsErr(null);
    } catch (err) {
      setPostsErr(err instanceof Error ? err.message : 'unknown');
    } finally {
      setPostsLoading(false);
    }
  }, []);

  const loadAccounts = React.useCallback(async () => {
    try {
      const res = await fetch('/api/vater/social-accounts', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SocialAccountsResp;
      setAccounts(data);
      setAccountsErr(null);
    } catch (err) {
      setAccountsErr(err instanceof Error ? err.message : 'unknown');
    }
  }, []);

  React.useEffect(() => {
    void loadPosts();
    void loadAccounts();
  }, [loadPosts, loadAccounts]);

  const counts = React.useMemo(() => {
    const c: Record<string, { pending: number; posted: number; failed: number }> = {};
    for (const p of posts) {
      const key = p.platform.toLowerCase();
      if (!c[key]) c[key] = { pending: 0, posted: 0, failed: 0 };
      if (p.status === 'pending' || p.status === 'scheduled') c[key].pending += 1;
      else if (p.status === 'posted') c[key].posted += 1;
      else if (p.status === 'failed') c[key].failed += 1;
    }
    return c;
  }, [posts]);

  const filtered = React.useMemo(() => {
    if (filter === 'all') return posts;
    if (filter === 'pending')
      return posts.filter((p) => p.status === 'pending' || p.status === 'scheduled');
    if (filter === 'posted') return posts.filter((p) => p.status === 'posted');
    if (filter === 'failed') return posts.filter((p) => p.status === 'failed');
    return posts;
  }, [posts, filter]);

  const handleRetry = async (post: ContentPost) => {
    if (!POSTS_AUTH_KEY) {
      setPostsErr('Publishing queue unavailable — contact admin.');
      return;
    }
    setRetryingId(post.id);
    try {
      const res = await fetch('/api/content/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': POSTS_AUTH_KEY },
        cache: 'no-store',
        body: JSON.stringify({
          subscriberId: post.subscriberId,
          platform: post.platform,
          contentType: post.contentType,
          postBody: post.body,
          mediaUrls: post.mediaUrls ?? [],
          scheduledAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadPosts();
    } catch (err) {
      setPostsErr(err instanceof Error ? err.message : 'retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: t.text, margin: 0 }}>Publishing</h2>
        <p style={{ fontSize: 14, color: t.textSecondary, margin: '4px 0 0' }}>
          Multi-platform queue: TikTok / IG / YouTube / FB / Pinterest. Same source, staggered slots.
        </p>
      </div>

      {/* Per-platform tiles */}
      <VCard style={{ marginBottom: 16 }}>
        <SectionTitle icon="upload" title="Connected platforms" sub="Pending / posted / failed counts in the last 100 rows." />
        {accountsErr && <ErrorBar message={`Could not load social accounts: ${accountsErr}`} />}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          {SUPPORTED_PLATFORMS.map((p) => {
            const meta = PLATFORM_META[p];
            const acc = accounts?.byPlatform?.[p];
            const c = counts[p] ?? { pending: 0, posted: 0, failed: 0 };
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
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>
                  {connected ? acc?.displayName ?? 'connected' : 'not connected'}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Pill label="Pending" value={c.pending} color={JELLY_TOKENS.accent} />
                  <Pill label="Posted" value={c.posted} color={JELLY_TOKENS.success} />
                  <Pill label="Failed" value={c.failed} color={JELLY_TOKENS.error} />
                </div>
              </div>
            );
          })}
        </div>
      </VCard>

      {/* Queue list */}
      <VCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <SectionTitle icon="history" title="Publishing queue" sub="Newest first; deduped by /api/content/posts." />
          <div style={{ display: 'inline-flex', gap: 4 }}>
            {(['pending', 'posted', 'failed', 'all'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                style={{
                  padding: '6px 12px',
                  borderRadius: JELLY_TOKENS.radius.pill,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'capitalize',
                  background: filter === s ? JELLY_TOKENS.brand : 'transparent',
                  color: filter === s ? '#fff' : t.textSecondary,
                  fontFamily: JELLY_TOKENS.font,
                }}
              >
                {s}
              </button>
            ))}
            <VBtn variant="text" size="sm" onClick={() => void loadPosts()}>
              Refresh
            </VBtn>
          </div>
        </div>

        {postsErr && <ErrorBar message={postsErr} />}

        {postsLoading ? (
          <SkeletonRows rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={
              postsErr
                ? 'Cannot list the queue without a sync key.'
                : `No ${filter} posts in the last 100 rows. Jelly queues posts here automatically when a project hits "ready".`
            }
          />
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {filtered.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                disabled={retryingId === post.id}
                onRetry={() => void handleRetry(post)}
              />
            ))}
          </div>
        )}
      </VCard>
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

function PostRow({
  post,
  disabled,
  onRetry,
}: {
  post: ContentPost;
  disabled: boolean;
  onRetry: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const meta =
    (PLATFORM_META as Record<string, (typeof PLATFORM_META)[Platform]>)[post.platform.toLowerCase()] ??
    { label: post.platform, emoji: '•', tint: JELLY_TOKENS.brand };
  const statusColor =
    post.status === 'posted'
      ? JELLY_TOKENS.success
      : post.status === 'failed'
        ? JELLY_TOKENS.error
        : JELLY_TOKENS.accent;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 110px 90px 110px',
        gap: 12,
        alignItems: 'center',
        padding: 10,
        background: t.cardAlt,
        border: `1px solid ${t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
      }}
    >
      <div style={{ fontSize: 22, textAlign: 'center' }}>{meta.emoji}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: t.text, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {post.body || '(no body)'}
        </div>
        {post.errorMessage && (
          <div style={{ fontSize: 11, color: JELLY_TOKENS.error, marginTop: 2 }}>
            {post.errorMessage}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: t.textSecondary }}>{meta.label}</div>
      <div>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: JELLY_TOKENS.radius.pill,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            background: 'transparent',
            border: `1px solid ${statusColor}`,
            color: statusColor,
            letterSpacing: 0.4,
          }}
        >
          {post.status}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        {post.status === 'failed' || post.status === 'pending' || post.status === 'scheduled' ? (
          <VBtn size="sm" variant="outlined" onClick={onRetry} disabled={disabled}>
            {disabled ? '…' : 'Retry'}
          </VBtn>
        ) : (
          <span style={{ fontSize: 11, color: t.textDisabled }}>
            {post.postedAt ? new Date(post.postedAt).toLocaleString() : ''}
          </span>
        )}
      </div>
    </div>
  );
}
