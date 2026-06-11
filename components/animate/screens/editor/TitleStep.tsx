'use client';

/* TitleStep — Step 1 (TubeGen-parity 3-card layout).
 *
 * Three side-by-side cards: Sample List / YouTube Channel-or-Video / Your
 * Style. Each card has its own Generate button. Result list appears
 * below — clicking a title PATCHes /api/vater/youtube/[id] with
 * { sourceTitle } and the parent ProjectShell auto-advances to Script.
 *
 * Note: this step always operates on an existing project (created by
 * Phase 1's StylePickerModal → /api/vater/youtube/new-from-style). All
 * legacy in-step project-creation branches were removed.
 *
 * Endpoint contract (POST /api/vater/youtube/[id]/title/generate):
 *   - mode='sample' → { sampleTitles: string[], count }
 *       returns { titles } directly. 502 if DGX /vater/suggest-titles
 *       isn't deployed yet — surface a friendly error.
 *   - mode='channel' → { url, count }
 *       * Video URL → { jobId, polling } — we poll /poll until the
 *         project transcript is set, then re-call this endpoint with
 *         mode='sample' using transcript head as sampleTitles.
 *       * Channel page URL → 501. We render a "coming soon — paste a
 *         specific video URL" message.
 *   - mode='style' → { count } → { titles }.
 */

import * as React from 'react';
import { JELLY_TOKENS, SECTION_PRICES } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn, VCard } from '../../primitives';
import type { EditorStepProps, EditorProject } from './ProjectShell';

interface CardDef {
  kind: 'sample' | 'channel' | 'style';
  icon: string;
  color: string;
  title: string;
  desc: string;
}

const CARDS: CardDef[] = [
  {
    kind: 'sample',
    icon: 'description',
    color: JELLY_TOKENS.brand,
    title: 'Generate from Sample List',
    desc: 'Paste sample titles you admire. We mirror their tone and structure.',
  },
  {
    kind: 'channel',
    icon: 'play',
    color: '#E87040',
    title: 'Generate from YouTube Channel',
    desc: 'Paste a YouTube video URL. We transcribe it and generate titles in that channel’s voice.',
  },
  {
    kind: 'style',
    icon: 'sparkle',
    color: '#9C27B0',
    title: 'Generate from Your Style',
    desc: 'Use your style’s reference videos to generate titles in your own voice.',
  },
];

interface TitleGenerateResponse {
  mode?: string;
  titles?: string[];
  jobId?: string;
  polling?: string;
  project?: EditorProject;
  error?: string;
  detail?: string;
}

interface PollResponse {
  project?: EditorProject;
  status?: string;
  error?: string;
}

const TRANSCRIPT_POLL_INTERVAL_MS = 2500;
const TRANSCRIPT_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function TitleStep({
  projectId,
  project,
  refresh,
}: EditorStepProps): React.ReactElement {
  const { t } = useTheme();
  const [sampleText, setSampleText] = React.useState('');
  const [channelUrl, setChannelUrl] = React.useState('');
  const [busyKind, setBusyKind] = React.useState<CardDef['kind'] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [titles, setTitles] = React.useState<string[]>([]);
  const [picking, setPicking] = React.useState(false);

  // Hydrate suggested titles from the project on mount so users who reload
  // mid-step keep their generated list.
  React.useEffect(() => {
    if (Array.isArray(project?.titleSuggestions)) {
      const arr = project?.titleSuggestions as unknown[];
      const strs = arr.filter((x): x is string => typeof x === 'string');
      if (strs.length > 0) setTitles(strs);
    }
  }, [project?.titleSuggestions]);

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pasted = e.clipboardData.getData('text');
      if (pasted) setChannelUrl(pasted);
    },
    [],
  );

  const callGenerate = React.useCallback(
    async (
      body: { mode: CardDef['kind']; sampleTitles?: string[]; url?: string },
    ): Promise<TitleGenerateResponse> => {
      if (!projectId) throw new Error('No project loaded');
      const res = await fetch(
        `/api/vater/youtube/${projectId}/title/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, count: 5 }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as TitleGenerateResponse;
      if (!res.ok) {
        if (res.status === 502) {
          throw new Error(
            data.detail
              ? `DGX suggest-titles not ready yet — ${data.detail}`
              : 'DGX suggest-titles is not deployed yet. Try Sample List manually or come back soon.',
          );
        }
        if (res.status === 501) {
          throw new Error(
            data.error || 'Channel-page mode coming soon — paste a specific video URL.',
          );
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    },
    [projectId],
  );

  /* Poll /poll until the project transcript is populated, then re-call
   * /title/generate with mode='sample' using transcript-derived samples.
   * Times out after 5 min (matches the legacy fetchSource ceiling). */
  const waitForTranscriptThenSample = React.useCallback(
    async (): Promise<string[]> => {
      if (!projectId) throw new Error('No project loaded');
      const start = Date.now();
      while (Date.now() - start < TRANSCRIPT_POLL_TIMEOUT_MS) {
        await new Promise((r) =>
          setTimeout(r, TRANSCRIPT_POLL_INTERVAL_MS),
        );
        try {
          const res = await fetch(`/api/vater/youtube/${projectId}/poll`, {
            method: 'GET',
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as PollResponse;
            throw new Error(data.error || `Poll HTTP ${res.status}`);
          }
        } catch (err) {
          throw err instanceof Error ? err : new Error('Poll failed');
        }
        // Refresh the project state and read transcript directly off the
        // refreshed record. We bounce through the same GET that
        // ProjectShell's refresh() uses so we share its error semantics.
        const projRes = await fetch(`/api/vater/youtube/${projectId}`);
        if (!projRes.ok) {
          const data = (await projRes.json().catch(() => ({}))) as PollResponse;
          throw new Error(data.error || `HTTP ${projRes.status}`);
        }
        const projData = (await projRes.json()) as { project: EditorProject & { transcript?: string | null } };
        const transcript = projData.project.transcript;
        if (typeof transcript === 'string' && transcript.trim().length > 0) {
          // Derive sampleTitles from the transcript head (first ~25 lines)
          // so the LLM has anchor text to mirror tone against. Two newlines
          // collapse so multi-blank gaps don't eat the budget.
          const lines = transcript
            .split(/\n+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .slice(0, 25);
          if (lines.length === 0) {
            throw new Error('Transcript was empty — try a different URL.');
          }
          const data = await callGenerate({ mode: 'sample', sampleTitles: lines });
          return Array.isArray(data.titles) ? data.titles : [];
        }
      }
      throw new Error('Transcribe timed out after 5 minutes.');
    },
    [projectId, callGenerate],
  );

  const handleGenerate = React.useCallback(
    async (kind: CardDef['kind']) => {
      setError(null);
      setBusyKind(kind);
      try {
        if (kind === 'sample') {
          const samples = sampleText
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (samples.length === 0) {
            throw new Error('Paste at least one sample title before generating.');
          }
          const data = await callGenerate({ mode: 'sample', sampleTitles: samples });
          setTitles(data.titles ?? []);
        } else if (kind === 'channel') {
          const url = channelUrl.trim();
          if (!url) {
            throw new Error('Paste a YouTube video URL before generating.');
          }
          const data = await callGenerate({ mode: 'channel', url });
          if (Array.isArray(data.titles) && data.titles.length > 0) {
            setTitles(data.titles);
          } else if (data.jobId) {
            // Two-step path — poll for transcript then re-generate.
            await refresh();
            const ts = await waitForTranscriptThenSample();
            setTitles(ts);
          } else {
            throw new Error('Channel mode returned no titles and no job — try again.');
          }
          await refresh();
        } else {
          // style mode
          const data = await callGenerate({ mode: 'style' });
          setTitles(data.titles ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Generate failed');
      } finally {
        setBusyKind(null);
      }
    },
    [sampleText, channelUrl, callGenerate, refresh, waitForTranscriptThenSample],
  );

  const handlePickTitle = React.useCallback(
    async (chosen: string) => {
      if (!projectId) return;
      setPicking(true);
      setError(null);
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceTitle: chosen }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not set title');
      } finally {
        setPicking(false);
      }
    },
    [projectId, refresh],
  );

  const sourceTitle = project?.sourceTitle?.trim() ?? '';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div
        style={{
          fontSize: 11,
          color: JELLY_TOKENS.brand,
          fontWeight: 600,
          marginBottom: 12,
        }}
      >
        Cost: {SECTION_PRICES.title}
      </div>

      {sourceTitle && (
        <VCard
          variant="flat"
          style={{
            marginBottom: 16,
            padding: 16,
            border: `1px solid ${JELLY_TOKENS.success}`,
            background: 'rgba(34,197,94,0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="sparkle" size={18} color={JELLY_TOKENS.success} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: t.textSecondary }}>
                Current title
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>
                {sourceTitle}
              </div>
            </div>
          </div>
        </VCard>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
        }}
      >
        {CARDS.map((card) => {
          const busy = busyKind === card.kind;
          return (
            <VCard
              key={card.kind}
              variant="flat"
              style={{
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                border: `1px solid ${t.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: card.color + '18',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={card.icon} size={20} color={card.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {card.title}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.4 }}>
                {card.desc}
              </div>

              {card.kind === 'sample' && (
                <textarea
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  placeholder={
                    "Top 10 facts you didn't know about ...\nThe REAL story behind ...\n5 things only insiders know about ..."
                  }
                  rows={5}
                  style={{
                    width: '100%',
                    fontSize: 13,
                    fontFamily: JELLY_TOKENS.font,
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: t.card,
                    color: t.text,
                    outline: 'none',
                    padding: 10,
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {card.kind === 'channel' && (
                <input
                  type="url"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="https://youtu.be/abc123 or https://youtube.com/watch?v=..."
                  style={{
                    width: '100%',
                    fontSize: 13,
                    fontFamily: JELLY_TOKENS.font,
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: t.card,
                    color: t.text,
                    outline: 'none',
                    padding: '10px 12px',
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {card.kind === 'style' && (
                <div style={{ fontSize: 12, color: t.textSecondary, padding: '6px 0' }}>
                  Uses the style attached to this project.
                </div>
              )}

              <VBtn
                variant="primary"
                onClick={() => handleGenerate(card.kind)}
                disabled={
                  busy ||
                  busyKind !== null ||
                  (card.kind === 'channel' && !channelUrl.trim()) ||
                  (card.kind === 'sample' && !sampleText.trim())
                }
                icon="sparkle"
              >
                {busy ? 'Generating…' : 'Generate Titles'}
              </VBtn>
            </VCard>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: '10px 14px',
            fontSize: 13,
            borderRadius: JELLY_TOKENS.radius.md,
            background: 'rgba(220,38,38,0.08)',
            color: JELLY_TOKENS.error,
            border: `1px solid ${JELLY_TOKENS.error}`,
          }}
        >
          {error}
        </div>
      )}

      {titles.length > 0 && (
        <VCard variant="flat" style={{ marginTop: 16, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 8 }}>
            Suggested Titles
          </div>
          <div style={{ fontSize: 12, color: t.textSecondary, marginBottom: 12 }}>
            Click a title to commit it and move on to Script.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {titles.map((tt, i) => {
              const active = sourceTitle === tt.trim();
              return (
                <div
                  key={`${i}-${tt}`}
                  onClick={picking ? undefined : () => handlePickTitle(tt)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: active
                      ? `2px solid ${JELLY_TOKENS.success}`
                      : `1px solid ${t.border}`,
                    background: active ? 'rgba(34,197,94,0.08)' : t.card,
                    cursor: picking ? 'progress' : 'pointer',
                    fontSize: 14,
                    color: t.text,
                    transition: 'background .15s',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: JELLY_TOKENS.brand,
                      marginRight: 8,
                    }}
                  >
                    {i + 1}.
                  </span>
                  {tt}
                </div>
              );
            })}
          </div>
        </VCard>
      )}
    </div>
  );
}
