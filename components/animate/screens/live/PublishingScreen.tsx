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
import { useTier } from '../../tier-context';
import { VCard, VBtn } from '../../primitives';
import { SectionTitle, EmptyState, ErrorBar, SkeletonRows } from './AutopilotScreen';
import {
  ConnectionsPanel,
  PLATFORM_META,
  type SocialPlatform,
} from './ConnectionsPanel';

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

/** A user's own aggregator publish (VaterSocialPost). */
interface SocialPost {
  id: string;
  projectId: string;
  status: string;
  caption?: string | null;
  platforms: Array<{ platform: string; status?: string; publishedUrl?: string; error?: string }>;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

// Auth is the admin session cookie (same-origin fetch sends it automatically).
// The old NEXT_PUBLIC_AUTOPILOT_KEY path was removed — a write-capable secret
// must never ship in the browser bundle.

export function PublishingScreen(): React.ReactElement {
  const { t } = useTheme();
  // /api/content/posts is site-admin only. For everyone else the queue card
  // rendered a permanent "contact admin" error; hide it instead. Connected
  // accounts and per-project publishing stay available to all users.
  const { capabilities } = useTier();
  const showQueue = capabilities.publishingPosts;
  const [posts, setPosts] = React.useState<ContentPost[]>([]);
  const [postsErr, setPostsErr] = React.useState<string | null>(null);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<StatusFilter>('pending');
  const [retryingId, setRetryingId] = React.useState<string | null>(null);
  // Every user's own multi-platform publishes (via the aggregator).
  const [socialPosts, setSocialPosts] = React.useState<SocialPost[]>([]);
  const [socialCounts, setSocialCounts] = React.useState({ pending: 0, posted: 0, failed: 0 });
  const [socialErr, setSocialErr] = React.useState<string | null>(null);
  const [socialFilter, setSocialFilter] = React.useState<StatusFilter>('all');
  // Direct-connect availability (ANIMATE_SOCIAL_VENDOR set server-side).
  const [vendorEnabled, setVendorEnabled] = React.useState<boolean | null>(null);
  // Post-OAuth flash: ?social=connected|pending|error&platform=…
  const [flash, setFlash] = React.useState<{ kind: string; platform: string } | null>(null);

  const loadPosts = React.useCallback(async () => {
    if (!showQueue) {
      setPosts([]);
      setPostsLoading(false);
      return;
    }
    setPostsLoading(true);
    try {
      const url = new URL('/api/content/posts', window.location.origin);
      url.searchParams.set('limit', '100');
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
  }, [showQueue]);

  const loadSocialPosts = React.useCallback(async () => {
    try {
      const res = await fetch('/api/vater/social-posts?limit=100', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { posts: SocialPost[]; counts: typeof socialCounts };
      setSocialPosts(data.posts ?? []);
      setSocialCounts(data.counts ?? { pending: 0, posted: 0, failed: 0 });
      setSocialErr(null);
    } catch (err) {
      setSocialErr(err instanceof Error ? err.message : 'unknown');
    }
  }, []);

  React.useEffect(() => {
    void loadPosts();
    void loadSocialPosts();
    try {
      const sp = new URLSearchParams(window.location.search);
      const kind = sp.get('social');
      if (kind) {
        setFlash({ kind, platform: sp.get('platform') ?? '' });
        // Clean the query so a refresh doesn't re-flash; keep the hash route.
        const clean = `${window.location.pathname}${window.location.hash}`;
        window.history.replaceState(null, '', clean);
      }
    } catch {
      /* SSR / private mode */
    }
  }, [loadPosts, loadSocialPosts]);

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
    setRetryingId(post.id);
    try {
      const res = await fetch('/api/content/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          Connect your own channels once, then post any finished video to all of them from the publish panel.
        </p>
      </div>

      {flash && (
        <div
          role="status"
          style={{
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${flash.kind === 'connected' ? JELLY_TOKENS.success : flash.kind === 'error' ? JELLY_TOKENS.error : JELLY_TOKENS.accent}`,
            color: t.text,
            fontSize: 13,
          }}
        >
          {flash.kind === 'connected' && `✅ ${PLATFORM_META[flash.platform as SocialPlatform]?.label ?? flash.platform} connected. You can post to it from any finished video.`}
          {flash.kind === 'pending' && `Almost there — ${PLATFORM_META[flash.platform as SocialPlatform]?.label ?? flash.platform} hasn't reported back yet. Refresh in a few seconds; if it stays disconnected, hit Connect again.`}
          {flash.kind === 'error' && `Could not start the ${PLATFORM_META[flash.platform as SocialPlatform]?.label ?? flash.platform} connection. Try again in a moment.`}
          {flash.kind === 'signin' && 'Your session expired mid-connect. Sign in and try again.'}
          {flash.kind === 'billing' && `Connecting ${PLATFORM_META[flash.platform as SocialPlatform]?.label ?? 'an account'} costs $6/month from your Jelly credit, and your balance is under $6 — top up on the Billing page, then connect.`}
        </div>
      )}

      <ConnectionsPanel
        syncOnLoad
        showQueuePills={showQueue}
        queueCounts={counts}
        onAccounts={(_data, vendor) => {
          if (vendor !== null) setVendorEnabled(vendor);
        }}
      />

      {/* Your publishes — every user's own multi-platform posts. */}
      {vendorEnabled !== false && (
        <VCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <SectionTitle
              icon="history"
              title="Your posts"
              sub={`${socialCounts.pending} pending · ${socialCounts.posted} posted · ${socialCounts.failed} failed`}
            />
            <div style={{ display: 'inline-flex', gap: 4 }}>
              {(['all', 'pending', 'posted', 'failed'] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSocialFilter(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: JELLY_TOKENS.radius.pill,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    textTransform: 'capitalize',
                    background: socialFilter === s ? JELLY_TOKENS.gradPrimary : 'transparent',
                    color: socialFilter === s ? JELLY_TOKENS.onGradient : t.textSecondary,
                    fontFamily: JELLY_TOKENS.font,
                  }}
                >
                  {s}
                </button>
              ))}
              <VBtn variant="text" size="sm" onClick={() => void loadSocialPosts()}>
                Refresh
              </VBtn>
            </div>
          </div>
          {socialErr && <ErrorBar message={socialErr} />}
          {(() => {
            const rows = socialPosts.filter((r) => {
              if (socialFilter === 'all') return true;
              if (socialFilter === 'posted') return r.status === 'published';
              if (socialFilter === 'failed') return ['failed', 'partial', 'cancelled'].includes(r.status);
              return !['published', 'failed', 'partial', 'cancelled'].includes(r.status);
            });
            if (rows.length === 0) {
              return (
                <EmptyState
                  message={
                    socialPosts.length === 0
                      ? 'Nothing posted yet. Open a finished video → Publish → pick your connected platforms.'
                      : `No ${socialFilter} posts.`
                  }
                />
              );
            }
            return (
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                {rows.map((r) => (
                  <SocialPostRow key={r.id} post={r} />
                ))}
              </div>
            );
          })()}
        </VCard>
      )}

      {/* Queue list — site-admin content calendar only. */}
      {showQueue && (
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
                  background: filter === s ? JELLY_TOKENS.gradPrimary : 'transparent',
                  color: filter === s ? JELLY_TOKENS.onGradient : t.textSecondary,
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
      )}
    </div>
  );
}


function SocialPostRow({ post }: { post: SocialPost }): React.ReactElement {
  const { t } = useTheme();
  const statusColor =
    post.status === 'published'
      ? JELLY_TOKENS.success
      : ['failed', 'partial', 'cancelled'].includes(post.status)
        ? JELLY_TOKENS.error
        : JELLY_TOKENS.accent;
  const when = post.publishedAt ?? post.scheduledFor ?? post.createdAt;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: 10,
        background: t.cardAlt,
        border: `1px solid ${t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: t.text, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {post.caption || '(no caption)'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
          {post.platforms.map((pl, i) => {
            const meta = (PLATFORM_META as Record<string, { label: string; emoji: string }>)[pl.platform] ?? { label: pl.platform, emoji: '•' };
            const ok = pl.status === 'published';
            const bad = pl.status === 'failed';
            const color = ok ? JELLY_TOKENS.success : bad ? JELLY_TOKENS.error : t.textSecondary;
            const inner = (
              <span style={{ fontSize: 11, color, display: 'inline-flex', gap: 4, alignItems: 'center' }} title={pl.error ?? pl.status ?? ''}>
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                {pl.status && <span style={{ opacity: 0.8 }}>· {pl.status}</span>}
              </span>
            );
            return pl.publishedUrl ? (
              <a key={i} href={pl.publishedUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                {inner}
              </a>
            ) : (
              <React.Fragment key={i}>{inner}</React.Fragment>
            );
          })}
        </div>
        {post.lastError && (
          <div style={{ fontSize: 11, color: JELLY_TOKENS.error, marginTop: 4 }}>{post.lastError}</div>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: JELLY_TOKENS.radius.pill,
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            border: `1px solid ${statusColor}`,
            color: statusColor,
            letterSpacing: 0.4,
          }}
        >
          {post.status}
        </span>
        <div style={{ fontSize: 10, color: t.textDisabled, marginTop: 4 }}>
          {new Date(when).toLocaleString()}
        </div>
      </div>
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
    (PLATFORM_META as Record<string, { label: string; emoji: string }>)[post.platform.toLowerCase()] ??
    { label: post.platform, emoji: '•' };
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
