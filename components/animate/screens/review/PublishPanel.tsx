'use client';

/* PublishPanel — the last stage of the Script Review pipeline.
 *
 * Three things happen here, in order, and every one of them is a click:
 *   1. Metadata  — generate title/description/tags with Gemini, edit them,
 *                  save them onto the project row.
 *   2. Thumbnail — generate 3 concepts, pick one, render it. Concepts are
 *                  constrained to two words of overlay text and to scenes
 *                  that actually occur in the video.
 *   3. Upload    — pick a privacy level and push it to the connected channel.
 *
 * Nothing here fires on its own: no autosave, no upload-on-ready. The upload
 * button is the only thing that publishes (feedback_no_autonomous_sends.md).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, VInput, RetryError, SectionHeader } from '../../primitives';
import { PublishDecisionModal } from './PublishDecisionModal';
import type { ReviewProject } from './ScriptReviewScreen';

interface ThumbnailConcept {
  conceptTitle: string;
  sceneDescription: string;
  overlayText: string;
}

interface SocialAccount {
  platform: string;
  displayName: string | null;
  status: string;
  lastError: string | null;
}

const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'unlisted', label: 'Unlisted' },
  { value: 'private', label: 'Private' },
] as const;

/** Read `publishAt` off the project's feature bag, if a schedule was set. */
function readPublishAt(settingsJson: unknown): string | null {
  if (!settingsJson || typeof settingsJson !== 'object' || Array.isArray(settingsJson)) {
    return null;
  }
  const raw = (settingsJson as Record<string, unknown>).publishAt;
  if (typeof raw !== 'string' || !Number.isFinite(Date.parse(raw))) return null;
  return raw;
}

export function PublishPanel({
  project,
  onChanged,
}: {
  project: ReviewProject;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();

  const [title, setTitle] = React.useState(project.publishTitle ?? '');
  const [description, setDescription] = React.useState(project.description ?? '');
  const [tags, setTags] = React.useState(project.tags.join(', '));
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [metaError, setMetaError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const dirty =
    title !== (project.publishTitle ?? '') ||
    description !== (project.description ?? '') ||
    tags !== project.tags.join(', ');

  const patch = async (data: Record<string, unknown>): Promise<void> => {
    const res = await fetch(`/api/vater/youtube/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `HTTP ${res.status}`);
    }
  };

  const parsedTags = React.useMemo(
    () =>
      tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [tags],
  );

  const generateMetadata = async (): Promise<void> => {
    setMetaError(null);
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/vater/youtube/${project.id}/social-metadata?platform=youtube`,
        { method: 'POST' },
      );
      const data = (await res.json().catch(() => ({}))) as {
        title?: string;
        description?: string;
        hashtags?: string[];
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      const nextTitle = data.title ?? '';
      const nextDescription = data.description ?? '';
      const nextTags = data.hashtags ?? [];
      setTitle(nextTitle);
      setDescription(nextDescription);
      setTags(nextTags.join(', '));
      // Persist immediately so a closed tab doesn't lose the generation the
      // user just paid for; they can still edit and save again on top.
      await patch({
        publishTitle: nextTitle,
        description: nextDescription,
        tags: nextTags,
      });
      setSavedAt(Date.now());
      onChanged();
    } catch (err) {
      setMetaError(
        err instanceof Error ? err.message : 'Could not generate metadata',
      );
    } finally {
      setGenerating(false);
    }
  };

  const saveMetadata = async (): Promise<void> => {
    setMetaError(null);
    setSaving(true);
    try {
      await patch({
        publishTitle: title,
        description,
        tags: parsedTags,
      });
      setSavedAt(Date.now());
      onChanged();
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : 'Could not save metadata');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Metadata ───────────────────────────────────────────────────── */}
      <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <SectionHeader
          icon="description"
          title="Title, description, tags"
          description="Generated from the finished script. Edit anything before you upload."
          actionLabel={generating ? 'Generating…' : 'Generate'}
          onAction={() => void generateMetadata()}
        />

        <VInput
          label="Title"
          value={title}
          onChange={setTitle}
          maxLength={100}
          helper={`${title.length}/100 — YouTube truncates past 100 characters`}
        />

        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: t.textSecondary,
              marginBottom: 6,
            }}
          >
            Description
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            style={{
              width: '100%',
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: JELLY_TOKENS.font,
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
              background: t.card,
              color: t.text,
              outline: 'none',
              boxSizing: 'border-box',
              padding: 14,
              resize: 'vertical',
            }}
          />
        </div>

        <VInput
          label="Tags"
          value={tags}
          onChange={setTags}
          helper={`Comma-separated — ${parsedTags.length} tag${parsedTags.length === 1 ? '' : 's'}`}
        />

        {metaError && (
          <RetryError message={metaError} onRetry={() => void generateMetadata()} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <VBtn
            variant="outlined"
            onClick={() => void saveMetadata()}
            disabled={saving || !dirty}
          >
            {saving ? 'Saving…' : 'Save'}
          </VBtn>
          <span style={{ fontSize: 12, color: t.textSecondary }}>
            {dirty
              ? 'Unsaved changes — the upload sends the saved version.'
              : savedAt
                ? 'Saved.'
                : 'Nothing to save.'}
          </span>
        </div>
      </VCard>

      <ThumbnailSection project={project} onChanged={onChanged} />

      <UploadSection
        project={project}
        canUpload={
          !!project.publishTitle?.trim() && !!project.description?.trim() && !dirty
        }
        onChanged={onChanged}
      />

      <SocialPublishSection
        project={project}
        defaultCaption={description}
        canPublish={project.status === 'ready' && !!project.finalVideoUrl}
      />

      <ShortPromoSection project={project} onChanged={onChanged} />
    </div>
  );
}

/* ─── Social (TikTok / IG / FB / Pinterest / X / LinkedIn via aggregator) ─── */

const SOCIAL_PLATFORMS = [
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'instagram', label: 'Instagram', emoji: '📷' },
  { id: 'facebook', label: 'Facebook', emoji: '📘' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌' },
  { id: 'twitter', label: 'X', emoji: '🐦' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
] as const;
type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]['id'];

interface VendorAccount extends SocialAccount {
  provider?: string;
  username?: string | null;
}

interface SocialPostResult {
  id: string;
  status: string;
  platforms: Array<{ platform: string; status?: string; publishedUrl?: string; error?: string }>;
  lastError?: string | null;
}

/**
 * Post the finished MP4 to the user's OWN connected non-YouTube accounts.
 * Every platform here is a checkbox the user ticks; nothing is pre-selected
 * and nothing fires without the button (feedback_no_autonomous_sends.md).
 */
function SocialPublishSection({
  project,
  defaultCaption,
  canPublish,
}: {
  project: ReviewProject;
  defaultCaption: string;
  canPublish: boolean;
}): React.ReactElement | null {
  const { t } = useTheme();
  const [accounts, setAccounts] = React.useState<Record<string, VendorAccount> | null>(null);
  const [vendorOn, setVendorOn] = React.useState<boolean | null>(null);
  const [picked, setPicked] = React.useState<Set<SocialPlatformId>>(new Set());
  const [caption, setCaption] = React.useState(defaultCaption);
  const [captionTouched, setCaptionTouched] = React.useState(false);
  // Post-now vs schedule is decided in the PublishDecisionModal (2026-08-20)
  // — the old inline datetime field was invisible enough that batch-produced
  // videos all went live instantly.
  const [decisionOpen, setDecisionOpen] = React.useState(false);
  const [tiktokPrivacy, setTiktokPrivacy] = React.useState('PUBLIC_TO_EVERYONE');
  const [tiktokLevels, setTiktokLevels] = React.useState<string[]>([]);
  const [boards, setBoards] = React.useState<Array<{ id: string; name: string }>>([]);
  const [boardId, setBoardId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<SocialPostResult[]>([]);

  // Keep the caption in step with the description until the user edits it.
  React.useEffect(() => {
    if (!captionTouched) setCaption(defaultCaption);
  }, [defaultCaption, captionTouched]);

  const load = React.useCallback(async () => {
    try {
      const sync = await fetch('/api/vater/social-accounts/sync', { method: 'POST', cache: 'no-store' });
      if (sync.ok) {
        const sd = (await sync.json()) as { vendor?: string | null };
        setVendorOn(Boolean(sd.vendor));
      }
      const res = await fetch('/api/vater/social-accounts', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { byPlatform: Record<string, VendorAccount> };
      setAccounts(data.byPlatform ?? {});
      const prior = await fetch(`/api/vater/social-posts?projectId=${project.id}&limit=10`, { cache: 'no-store' });
      if (prior.ok) {
        const pd = (await prior.json()) as { posts: SocialPostResult[] };
        setResults(pd.posts ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read connected accounts');
    }
  }, [project.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const connected = React.useMemo(
    () =>
      SOCIAL_PLATFORMS.filter((p) => {
        const a = accounts?.[p.id];
        return a && a.provider === 'zernio' && a.status === 'active';
      }),
    [accounts],
  );

  // Lazy per-platform options.
  React.useEffect(() => {
    if (!picked.has('tiktok') || tiktokLevels.length) return;
    void (async () => {
      const r = await fetch('/api/vater/social-accounts/tiktok/options', { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as { privacyLevels?: string[] };
      if (d.privacyLevels?.length) {
        setTiktokLevels(d.privacyLevels);
        if (!d.privacyLevels.includes(tiktokPrivacy)) setTiktokPrivacy(d.privacyLevels[0]);
      }
    })();
  }, [picked, tiktokLevels.length, tiktokPrivacy]);
  React.useEffect(() => {
    if (!picked.has('pinterest') || boards.length) return;
    void (async () => {
      const r = await fetch('/api/vater/social-accounts/pinterest/options', { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as { boards?: Array<{ id: string; name: string }> };
      if (d.boards?.length) {
        setBoards(d.boards);
        setBoardId((b) => b || d.boards![0].id);
      }
    })();
  }, [picked, boards.length]);

  if (vendorOn === false) return null; // aggregator not enabled → no section
  if (accounts && connected.length === 0) {
    return (
      <VCard>
        <SectionHeader
          icon="upload"
          title="Post to your socials"
          description="Connect TikTok, Instagram, Facebook, Pinterest, X or LinkedIn on the Publishing screen and this video can go out to all of them from here."
        />
        <VBtn variant="outlined" onClick={() => { window.location.hash = '#r=publishing'; }}>
          Connect platforms
        </VBtn>
      </VCard>
    );
  }

  const toggle = (id: SocialPlatformId) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const needsBoard = picked.has('pinterest') && !boardId;
  const ready = canPublish && picked.size > 0 && caption.trim().length > 0 && !needsBoard && !busy;

  /* scheduleIso comes from the decision modal — '' means post immediately. */
  const publish = async (scheduleIso: string): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/publish-social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: [...picked],
          caption,
          ...(scheduleIso
            ? {
                scheduleAt: scheduleIso,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              }
            : {}),
          ...(picked.has('tiktok') ? { tiktok: { privacyLevel: tiktokPrivacy } } : {}),
          ...(picked.has('pinterest') ? { pinterest: { boardId } } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; post?: SocialPostResult };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDecisionOpen(false);
      if (data.post) setResults((r) => [data.post!, ...r]);
      setPicked(new Set());
    } catch (err) {
      setDecisionOpen(false);
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <VCard>
      <SectionHeader
        icon="upload"
        title="Post to your socials"
        description="Same MP4, your caption, straight to the accounts you connected. Tick the platforms, then press Post."
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 12px' }}>
        {connected.map((p) => {
          const on = picked.has(p.id);
          const a = accounts?.[p.id];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              aria-pressed={on}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: JELLY_TOKENS.radius.pill,
                border: `1px solid ${on ? JELLY_TOKENS.brand : t.border}`,
                background: on ? JELLY_TOKENS.gradTicket : t.card,
                color: t.text,
                fontFamily: JELLY_TOKENS.font,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <span>{p.emoji}</span>
              <span style={{ fontWeight: 600 }}>{p.label}</span>
              {a?.username && (
                <span style={{ fontSize: 11, color: t.textSecondary }}>@{a.username.replace(/^@/, '')}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, marginBottom: 6 }}>
          Caption <span style={{ opacity: 0.7 }}>(X gets the first 270 characters)</span>
        </div>
        <textarea
          value={caption}
          onChange={(e) => {
            setCaptionTouched(true);
            setCaption(e.target.value);
          }}
          rows={4}
          style={{
            width: '100%',
            fontSize: 14,
            fontFamily: JELLY_TOKENS.font,
            border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.md,
            background: t.card,
            color: t.text,
            outline: 'none',
            boxSizing: 'border-box',
            padding: 12,
            resize: 'vertical',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        {picked.has('tiktok') && (
          <label style={{ fontSize: 12, color: t.textSecondary, display: 'grid', gap: 4 }}>
            TikTok visibility
            <select
              value={tiktokPrivacy}
              onChange={(e) => setTiktokPrivacy(e.target.value)}
              style={{ padding: 8, borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${t.border}`, background: t.card, color: t.text, fontFamily: JELLY_TOKENS.font }}
            >
              {(tiktokLevels.length ? tiktokLevels : ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY']).map((lvl) => (
                <option key={lvl} value={lvl}>{lvl.replace(/_/g, ' ').toLowerCase()}</option>
              ))}
            </select>
          </label>
        )}
        {picked.has('pinterest') && (
          <label style={{ fontSize: 12, color: t.textSecondary, display: 'grid', gap: 4 }}>
            Pinterest board
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              style={{ padding: 8, borderRadius: JELLY_TOKENS.radius.md, border: `1px solid ${needsBoard ? JELLY_TOKENS.error : t.border}`, background: t.card, color: t.text, fontFamily: JELLY_TOKENS.font }}
            >
              {boards.length === 0 && <option value="">Loading boards…</option>}
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <RetryError message={error} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <VBtn onClick={() => setDecisionOpen(true)} disabled={!ready} icon="upload">
          {busy ? 'Posting…' : `Post to ${picked.size || '…'} platform${picked.size === 1 ? '' : 's'}…`}
        </VBtn>
        <span style={{ fontSize: 12, color: t.textSecondary }}>
          {!canPublish
            ? 'Finish rendering first.'
            : picked.size === 0
              ? 'Pick at least one platform.'
              : !caption.trim()
                ? 'Write a caption.'
                : needsBoard
                  ? 'Pick a Pinterest board.'
                  : 'Posts go out under your own accounts.'}
        </span>
      </div>

      {results.length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
          {results.map((r) => (
            <div key={r.id} style={{ fontSize: 12, color: t.textSecondary, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: r.status === 'published' ? JELLY_TOKENS.success : ['failed', 'partial'].includes(r.status) ? JELLY_TOKENS.error : t.text }}>
                {r.status}
              </span>
              {r.platforms.map((pl, i) =>
                pl.publishedUrl ? (
                  <a key={i} href={pl.publishedUrl} target="_blank" rel="noreferrer" style={{ color: JELLY_TOKENS.brand }}>
                    {pl.platform} ↗
                  </a>
                ) : (
                  <span key={i} title={pl.error ?? ''}>{pl.platform}{pl.status ? ` · ${pl.status}` : ''}</span>
                ),
              )}
              {r.lastError && <span style={{ color: JELLY_TOKENS.error }}>{r.lastError}</span>}
            </div>
          ))}
        </div>
      )}

      <PublishDecisionModal
        open={decisionOpen}
        mode="social"
        contextLine={`${picked.size} platform${picked.size === 1 ? '' : 's'}: ${[...picked].join(', ')}`}
        busy={busy}
        onConfirm={(scheduleIso) => void publish(scheduleIso)}
        onClose={() => setDecisionOpen(false)}
      />
    </VCard>
  );
}

/* ─── Short-form promo ─── */

function ShortPromoSection({
  project,
  onChanged,
}: {
  project: ReviewProject;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [cutting, setCutting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [caption, setCaption] = React.useState(project.shortDescription ?? '');
  const [savingCaption, setSavingCaption] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setCaption(project.shortDescription ?? '');
  }, [project.shortDescription]);

  const cut = async (): Promise<void> => {
    setError(null);
    setCutting(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/short`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSeconds: 30 }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cut the short');
    } finally {
      setCutting(false);
    }
  };

  const saveCaption = async (): Promise<void> => {
    setSavingCaption(true);
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortDescription: caption }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save caption');
    } finally {
      setSavingCaption(false);
    }
  };

  const copyCaption = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard denied — user can select manually */
    }
  };

  return (
    <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="sparkle"
        title="Short-form promo"
        description="A ~30s vertical cut of the hook, ready to cross-post everywhere to advertise the long-form. Publish to YouTube first so the caption carries the real link."
        actionLabel={
          cutting
            ? 'Cutting…'
            : project.shortVideoUrl
              ? 'Re-cut'
              : 'Cut short preview'
        }
        onAction={project.finalVideoUrl ? () => void cut() : undefined}
      />

      {!project.finalVideoUrl && (
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          Render the long-form first — the short is cut from the finished video.
        </div>
      )}

      {project.shortVideoUrl && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <video
            src={project.shortVideoUrl}
            controls
            style={{
              width: 180,
              aspectRatio: '9 / 16',
              borderRadius: JELLY_TOKENS.radius.md,
              background: JELLY_TOKENS.dark.cardAlt,
              flex: '0 0 auto',
            }}
          />
          <div
            style={{
              flex: '1 1 260px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary }}
            >
              Cross-post caption
              {project.youtubeVideoId
                ? ' (links the published video)'
                : ' — re-cut after publishing to bake in the real link'}
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={7}
              style={{
                width: '100%',
                fontSize: 14,
                lineHeight: 1.6,
                fontFamily: JELLY_TOKENS.font,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                background: t.card,
                color: t.text,
                outline: 'none',
                boxSizing: 'border-box',
                padding: 12,
                resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <VBtn
                variant="outlined"
                size="sm"
                onClick={() => void saveCaption()}
                disabled={savingCaption || caption === (project.shortDescription ?? '')}
              >
                {savingCaption ? 'Saving…' : 'Save caption'}
              </VBtn>
              <VBtn variant="ghost" size="sm" onClick={() => void copyCaption()}>
                {copied ? 'Copied!' : 'Copy caption'}
              </VBtn>
              <a
                href={project.shortVideoUrl}
                download
                style={{ alignSelf: 'center', fontSize: 13, color: t.textSecondary }}
              >
                Download MP4
              </a>
            </div>
          </div>
        </div>
      )}

      {error && <RetryError message={error} />}
    </VCard>
  );
}

/* ─── Thumbnail ─── */

function ThumbnailSection({
  project,
  onChanged,
}: {
  project: ReviewProject;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [concepts, setConcepts] = React.useState<ThumbnailConcept[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [rendering, setRendering] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Cache-buster: the thumbnail route serves the same URL with a 10-minute
  // private cache, so a re-render needs a new query to actually show up.
  const [version, setVersion] = React.useState(0);

  const loadConcepts = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/vater/youtube/${project.id}/thumbnail-concepts`,
        { method: 'POST' },
      );
      const data = (await res.json().catch(() => ({}))) as {
        concepts?: ThumbnailConcept[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.concepts) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setConcepts(data.concepts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load concepts');
    } finally {
      setLoading(false);
    }
  };

  const pick = async (concept: ThumbnailConcept): Promise<void> => {
    setError(null);
    setRendering(concept.conceptTitle);
    try {
      const savedConcept = await fetch(`/api/vater/youtube/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailConcept: concept.sceneDescription }),
      });
      if (!savedConcept.ok) {
        const data = (await savedConcept.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error || `HTTP ${savedConcept.status}`);
      }
      const res = await fetch(`/api/vater/youtube/${project.id}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptPrompt: concept.sceneDescription,
          overlayText: concept.overlayText,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setVersion((v) => v + 1);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not render thumbnail');
    } finally {
      setRendering(null);
    }
  };

  return (
    <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="thumbnail"
        title="Thumbnail"
        description="Three concepts drawn from the script — two words of overlay text, max."
        actionLabel={loading ? 'Thinking…' : concepts ? 'New concepts' : 'Generate concepts'}
        onAction={() => void loadConcepts()}
      />

      {project.thumbnailUrl && (
        <img
          src={`/api/vater/youtube/${project.id}/thumbnail?v=${version}`}
          alt="Current thumbnail"
          style={{
            width: '100%',
            maxWidth: 420,
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${t.border}`,
          }}
        />
      )}

      {error && <RetryError message={error} />}

      {concepts && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 12,
          }}
        >
          {concepts.map((c) => {
            const chosen = project.thumbnailConcept === c.sceneDescription;
            return (
              <div
                key={c.conceptTitle + c.sceneDescription.slice(0, 24)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  padding: 14,
                  borderRadius: JELLY_TOKENS.radius.md,
                  border: `1px solid ${chosen ? JELLY_TOKENS.brandOutline : t.border}`,
                  background: chosen ? JELLY_TOKENS.brandGhost : t.cardAlt,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  {c.conceptTitle}
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
                  {c.sceneDescription}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: JELLY_TOKENS.brand,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                  }}
                >
                  {c.overlayText || '(no overlay text)'}
                </div>
                <VBtn
                  size="sm"
                  variant={chosen ? 'ghost' : 'outlined'}
                  onClick={() => void pick(c)}
                  disabled={rendering !== null}
                >
                  {rendering === c.conceptTitle
                    ? 'Rendering…'
                    : chosen
                      ? 'Re-render this'
                      : 'Use this'}
                </VBtn>
              </div>
            );
          })}
        </div>
      )}
    </VCard>
  );
}

/* ─── Upload ─── */

function UploadSection({
  project,
  canUpload,
  onChanged,
}: {
  project: ReviewProject;
  canUpload: boolean;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [account, setAccount] = React.useState<SocialAccount | null | undefined>(
    undefined,
  );
  const [privacy, setPrivacy] = React.useState<string>('public');
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [watchUrl, setWatchUrl] = React.useState<string | null>(
    project.youtubeVideoId ? `https://youtu.be/${project.youtubeVideoId}` : null,
  );
  // Post-now vs schedule is decided in the PublishDecisionModal (2026-08-20).
  const [decisionOpen, setDecisionOpen] = React.useState(false);
  const scheduledAt = readPublishAt(project.settingsJson);

  const loadAccount = React.useCallback(async () => {
    try {
      const res = await fetch('/api/vater/social-accounts');
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        byPlatform: Record<string, SocialAccount | undefined>;
      };
      setAccount(data.byPlatform.youtube ?? null);
    } catch (err) {
      setAccount(null);
      setError(
        err instanceof Error ? err.message : 'Could not read connected accounts',
      );
    }
  }, []);

  React.useEffect(() => {
    void loadAccount();
  }, [loadAccount]);

  /* scheduleIso comes from the decision modal — '' means publish now. */
  const upload = async (scheduleIso: string): Promise<void> => {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyStatus: privacy,
          ...(scheduleIso ? { publishAt: scheduleIso } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setDecisionOpen(false);
      setWatchUrl(data.url);
      onChanged();
    } catch (err) {
      setDecisionOpen(false);
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (watchUrl) {
    return (
      <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeader
          icon="upload"
          title={scheduledAt ? 'Scheduled' : 'Published'}
          description={
            scheduledAt
              ? `Uploaded private — YouTube makes it public on ${new Date(
                  scheduledAt,
                ).toLocaleString()}.`
              : project.publishedAt
                ? `Uploaded ${new Date(project.publishedAt).toLocaleString()}`
                : 'Live on YouTube.'
          }
        />
        {scheduledAt && (
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: JELLY_TOKENS.warning,
            }}
          >
            Scheduled for {new Date(scheduledAt).toLocaleString()}
          </div>
        )}
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            color: JELLY_TOKENS.brand,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          {watchUrl}
        </a>
      </VCard>
    );
  }

  const connected = account && account.status === 'active';

  return (
    <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="upload"
        title="Upload to YouTube"
        description="Nothing is sent until you click Upload."
      />

      <div style={{ fontSize: 13, color: t.textSecondary }}>
        {account === undefined && 'Checking the connected channel…'}
        {account === null && 'No YouTube channel connected yet.'}
        {account && (
          <>
            Channel: <strong style={{ color: t.text }}>{account.displayName || 'connected'}</strong>
            {account.status !== 'active' && (
              <span style={{ color: JELLY_TOKENS.error }}>
                {' '}
                — {account.status}
                {account.lastError ? `: ${account.lastError}` : ''}. Reconnect to fix.
              </span>
            )}
          </>
        )}
      </div>

      {!connected && (
        <div>
          <VBtn
            onClick={() => {
              window.location.href =
                '/api/vater/social-accounts/oauth/youtube/start';
            }}
            icon="upload"
          >
            {account ? 'Reconnect YouTube' : 'Connect YouTube'}
          </VBtn>
        </div>
      )}

      <div style={{ maxWidth: 220 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: t.textSecondary,
            marginBottom: 6,
          }}
        >
          Privacy
        </div>
        <select
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value)}
          style={{
            width: '100%',
            fontSize: 16,
            fontFamily: JELLY_TOKENS.font,
            border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.md,
            background: t.card,
            color: t.text,
            outline: 'none',
            boxSizing: 'border-box',
            padding: 14,
          }}
        >
          {PRIVACY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && <RetryError message={error} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <VBtn
          onClick={() => setDecisionOpen(true)}
          disabled={!connected || !canUpload || uploading}
          icon="upload"
        >
          {uploading ? 'Uploading…' : 'Upload to YouTube…'}
        </VBtn>
        <span style={{ fontSize: 12, color: t.textSecondary }}>
          {!connected
            ? 'Connect a channel first.'
            : !canUpload
              ? 'Save a title and description first.'
              : 'Next: choose post now or schedule. The upload can take a couple of minutes.'}
        </span>
      </div>

      <PublishDecisionModal
        open={decisionOpen}
        mode="youtube"
        contextLine={
          account?.displayName
            ? `Channel: ${account.displayName}`
            : 'Your connected YouTube channel'
        }
        busy={uploading}
        onConfirm={(scheduleIso) => void upload(scheduleIso)}
        onClose={() => setDecisionOpen(false)}
      />
    </VCard>
  );
}
