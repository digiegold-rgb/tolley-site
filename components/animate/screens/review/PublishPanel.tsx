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

        {metaError && <RetryError message={metaError} />}

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
    </div>
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

  const upload = async (): Promise<void> => {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacyStatus: privacy }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setWatchUrl(data.url);
      onChanged();
    } catch (err) {
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
          title="Published"
          description={
            project.publishedAt
              ? `Uploaded ${new Date(project.publishedAt).toLocaleString()}`
              : 'Live on YouTube.'
          }
        />
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
          onClick={() => void upload()}
          disabled={!connected || !canUpload || uploading}
          icon="upload"
        >
          {uploading ? 'Uploading…' : 'Upload to YouTube'}
        </VBtn>
        <span style={{ fontSize: 12, color: t.textSecondary }}>
          {!connected
            ? 'Connect a channel first.'
            : !canUpload
              ? 'Save a title and description first.'
              : 'The upload can take a couple of minutes.'}
        </span>
      </div>
    </VCard>
  );
}
