'use client';

/* DescriptionStep — Step 7.
 *
 * Title input + Generate (POST /api/vater/youtube/[id]/social-metadata
 * ?platform=youtube → Gemini 2.5 Flash SEO copy), plus:
 *
 *  - the description is EDITABLE and savable onto the project row, so what
 *    the publish step uploads is what the user actually approved; and
 *  - "Add chapters + hashtags" (2026-08-16) appends a YouTube chapter list
 *    (GET …/chapters — DGX, or derived from the scene schedule) and 3–5
 *    hashtags to that text. Appended, never overwritten: the user's edits
 *    survive, and they can delete any line they don't want.
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, VInput, SectionHeader, Toast } from '../../primitives';
import type { EditorStepProps } from './ProjectShell';
import { reelLabel } from './reel-label';
import {
  featureFetch,
  FeatureUnavailableError,
  COMING_ONLINE,
} from './feature-fetch';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockReason,
} from './BillingBlock';

interface Chapter {
  startSec: number;
  title: string;
}

/** YouTube wants m:ss under an hour, h:mm:ss over it. */
function formatTimestamp(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export function DescriptionStep({ projectId, project, refresh }: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [title, setTitle] = React.useState(project?.sourceTitle ?? '');
  // 402 from a generation route → actionable modal, not a raw error string.
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [generated, setGenerated] = React.useState<{ description: string; tags: string[]; hashtags: string[] } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  /* The editable body. Seeded from the project row, replaced by Generate,
   * appended to by chapters. `dirty` gates the Save button. */
  const [description, setDescription] = React.useState(project?.description ?? '');
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const lastSaved = React.useRef<string>(project?.description ?? '');

  const [chaptersBusy, setChaptersBusy] = React.useState(false);
  const [chaptersOff, setChaptersOff] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => { if (project?.sourceTitle) setTitle(project.sourceTitle); }, [project?.sourceTitle]);

  React.useEffect(() => {
    const incoming = project?.description ?? '';
    // Only adopt the row's text when we have no unsaved edits, so a refresh
    // triggered by another action can't wipe what the user is typing.
    if (incoming !== lastSaved.current && !dirty) {
      lastSaved.current = incoming;
      setDescription(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.description]);

  const updateDescription = React.useCallback((next: string) => {
    setDescription(next);
    setDirty(next !== lastSaved.current);
  }, []);

  const generate = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      // POST, not GET — the route only exports POST, so the default-method
      // fetch this used to send came back 405 every time.
      const res = await fetch(
        `/api/vater/youtube/${projectId}/social-metadata?platform=youtube`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          cache: 'no-store',
        },
      );
      await assertOk(res);
      const data = await res.json();
      const next = {
        description: data.description ?? '',
        tags: data.tags ?? [],
        hashtags: data.hashtags ?? [],
      };
      setGenerated(next);
      if (next.description) updateDescription(next.description);
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
      } else {
        setError(err instanceof Error ? err.message : 'failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const save = React.useCallback(async () => {
    if (!projectId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      await assertOk(res);
      lastSaved.current = description;
      setDirty(false);
      await refresh();
      setToast('Description saved to the project.');
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
      } else {
        setError(err instanceof Error ? err.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  }, [projectId, description, refresh]);

  const addChapters = React.useCallback(async () => {
    if (!projectId) return;
    setChaptersBusy(true);
    setError(null);
    try {
      const data = await featureFetch<{ chapters?: Chapter[]; hashtags?: string[] }>(
        `/api/vater/youtube/${projectId}/chapters`,
      );
      const chapters = (data.chapters ?? []).filter(
        (c) => typeof c.startSec === 'number' && typeof c.title === 'string',
      );
      const hashtags = (data.hashtags ?? []).slice(0, 5);

      if (chapters.length === 0 && hashtags.length === 0) {
        setError('Nothing to add yet — render the scenes first.');
        return;
      }

      const blocks: string[] = [];
      if (chapters.length > 0) {
        blocks.push(
          ['Chapters', ...chapters.map((c) => `${formatTimestamp(c.startSec)} ${c.title}`)].join('\n'),
        );
      }
      if (hashtags.length > 0) blocks.push(hashtags.join(' '));

      const addition = blocks.join('\n\n');
      const next = description.trim()
        ? `${description.trimEnd()}\n\n${addition}`
        : addition;
      updateDescription(next);
      setToast(
        `Added ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}` +
          (hashtags.length ? ` and ${hashtags.length} hashtags.` : '.') +
          ' Save to keep them.',
      );
    } catch (err) {
      if (err instanceof FeatureUnavailableError) {
        setChaptersOff(true);
        setToast(err.message || COMING_ONLINE);
      } else {
        setError(err instanceof Error ? err.message : 'Chapters failed');
      }
    } finally {
      setChaptersBusy(false);
    }
  }, [projectId, description, updateDescription]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionHeader
        icon="description"
        eyebrow={reelLabel(6)}
        title="Description Generator"
        description={`Generate SEO-optimized YouTube descriptions with relevant keywords and hashtags. ${SECTION_PRICES.description}.`}
        actionLabel={busy ? 'Generating…' : 'Generate'}
        onAction={generate}
      />

      <VCard variant="flat">
        <VInput value={title} onChange={setTitle} placeholder="Enter your video title or generate with AI..." maxLength={100}
          helper={`${title.length} / 100 characters`} />
      </VCard>

      {error && (
        <VCard variant="flat" style={{ borderColor: JELLY_TOKENS.error }}>
          <div style={{ color: JELLY_TOKENS.error, fontSize: 13 }}>{error}</div>
        </VCard>
      )}

      <VCard variant="flat">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Description</div>
          <div style={{ flex: 1 }} />
          <div
            title={
              chaptersOff
                ? COMING_ONLINE
                : 'Append a timestamped chapter list and hashtags'
            }
          >
            <VBtn
              size="sm"
              variant="outlined"
              onClick={addChapters}
              disabled={chaptersBusy || chaptersOff || !projectId}
              data-testid="description-add-chapters"
            >
              {chaptersBusy ? 'Building…' : 'Add chapters + hashtags'}
            </VBtn>
          </div>
          <VBtn
            size="sm"
            onClick={save}
            disabled={saving || !dirty || !projectId}
            data-testid="description-save"
          >
            {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </VBtn>
        </div>

        <textarea
          value={description}
          onChange={(e) => updateDescription(e.target.value)}
          placeholder="Your YouTube description. Generate one above, or write it here — chapters and hashtags get appended to whatever is in this box."
          style={{
            width: '100%', minHeight: 220, padding: 12, fontFamily: JELLY_TOKENS.font, fontSize: 14,
            background: t.cardAlt, color: t.text, border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.sm, resize: 'vertical', boxSizing: 'border-box',
            lineHeight: 1.5, outline: 'none',
          }}
          data-testid="description-body"
        />
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6 }}>
          {description.length} characters
          {chaptersOff
            ? ` • ${COMING_ONLINE}`
            : ' • chapters need at least 3 entries starting at 0:00 for YouTube to show them'}
        </div>
      </VCard>

      {generated && (generated.tags.length > 0 || generated.hashtags.length > 0) && (
        <VCard variant="flat">
          {generated.tags.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {generated.tags.map((tag, i) => (
                  <span key={i} style={{
                    padding: '4px 10px', borderRadius: JELLY_TOKENS.radius.full,
                    background: JELLY_TOKENS.brandGhost, color: JELLY_TOKENS.brand,
                    fontSize: 12, fontWeight: 500,
                  }}>{tag}</span>
                ))}
              </div>
            </>
          )}
          {generated.hashtags.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginTop: 12, marginBottom: 6 }}>Hashtags</div>
              <div style={{ fontSize: 13, color: t.textSecondary }}>{generated.hashtags.join(' ')}</div>
            </>
          )}
        </VCard>
      )}
      <BillingBlockModal
        reason={billingBlock}
        onClose={() => setBillingBlock(null)}
      />
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
