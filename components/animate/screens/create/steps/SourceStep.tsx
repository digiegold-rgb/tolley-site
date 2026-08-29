'use client';

/* Step 1 — Source. Three doors (PathChooser, extracted from StylePickerModal):
 *
 *   video  → paste a link, Continue → step 2 reads the captions (free)
 *   own    → paste a script → row created with the script → straight to 5
 *   jelly  → row created, opens the editor ON the Script step (as today)
 *
 * The style pick (voice + cast) lives here because new-from-style needs one;
 * canon is pre-selected. Batch mode (≤10 scripts, Fable 5) stays in the old
 * modal behind one link — not ported into the stepper this pass.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme, useRoute } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { PathChooser, type StartPath } from '../../dashboard/PathChooser';
import { StylePickerModal } from '../../dashboard/StylePickerModal';
import { WORDS_PER_MINUTE } from '@/lib/vater/youtube-types';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage } from '../create-api';
import { StepCard, Lede, FieldLabel, ErrorNote, StepActions, DoneSummary, inputStyle, wordsIn } from './step-ui';

const URL_RE = /^https?:\/\/\S+\.\S+/;

export function SourceStep(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, openProjectInEditor } = useRoute();
  const flow = useCreateFlow();
  const { project, derived, readOnly, styles, stylesLoaded, styleId, setStyleId, pendingUrl, setPendingUrl } = flow;

  const [path, setPath] = React.useState<StartPath>(pendingUrl ? 'video' : 'own');
  const [url, setUrl] = React.useState(pendingUrl);
  const [script, setScript] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [batchOpen, setBatchOpen] = React.useState(false);

  const words = wordsIn(script);
  const noStyles = stylesLoaded && styles.length === 0;

  if (readOnly && project && derived) {
    const src = project.sourceUrl
      ? `Started from ${project.sourceUrl}`
      : project.topic
        ? `Started from the topic “${project.topic}”`
        : 'Started from your own script';
    return (
      <DoneSummary onContinue={() => flow.goTo(derived.step)} continueLabel={`Continue to step ${derived.step} →`} testId="source-done">
        {src}. To start from something else, make a new video.
      </DoneSummary>
    );
  }

  const requireStyle = (): string | null => {
    if (styleId) return styleId;
    setError('Pick a style first — it carries the voice and the cast.');
    return null;
  };

  const continueWithUrl = (): void => {
    const u = url.trim();
    if (!URL_RE.test(u)) {
      setError('Paste a full link — it should start with http:// or https://');
      return;
    }
    setError(null);
    setPendingUrl(u);
    flow.goTo(2);
  };

  const startWithOwnScript = async (): Promise<void> => {
    const trimmed = script.trim();
    if (words < 20) {
      setError('Paste a script first — at least a few sentences.');
      return;
    }
    const sid = requireStyle();
    if (!sid) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createApi.createFromStyle(sid);
      const saved = await createApi.patchProject(created.id, {
        script: trimmed,
        sourceTitle: trimmed.slice(0, 80),
        flowStep: 4,
      });
      flow.adopt(saved);
      flow.goTo(4);
    } catch (err) {
      setError(errorMessage(err, 'Could not start the project'));
    } finally {
      setBusy(false);
    }
  };

  const jellyWrites = async (): Promise<void> => {
    const sid = requireStyle();
    if (!sid) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createApi.createFromStyle(sid);
      // Same landing as today: the editor's Script step writes from the
      // title + notes and stops for approval there.
      openProjectInEditor(created.id, 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not start the project'));
      setBusy(false);
    }
  };

  return (
    <>
      <StepCard testId="source-step">
        <Lede>Where does this video start? Pick a door, then the style that gives it a voice and a cast.</Lede>
        <PathChooser
          path={path}
          disabled={busy}
          onChange={(p) => {
            setPath(p);
            setError(null);
          }}
        />

        {/* Style — the voice + cast a project is born with. */}
        <div>
          <FieldLabel>Style · voice &amp; cast</FieldLabel>
          {noStyles ? (
            <div style={{ marginTop: 6, fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>
              No styles yet — a style is the voice and the character every video renders with.{' '}
              <button
                type="button"
                onClick={() => setRoute('styles-list')}
                style={{ background: 'none', border: 'none', padding: 0, color: t.link, cursor: 'pointer', fontSize: 13, fontFamily: JELLY_TOKENS.font, textDecoration: 'underline' }}
              >
                Create one in Styles
              </button>{' '}
              and come back.
            </div>
          ) : (
            <select
              value={styleId ?? ''}
              onChange={(e) => setStyleId(e.target.value || null)}
              disabled={busy || !stylesLoaded}
              data-testid="create-style"
              aria-label="Style for voice and cast"
              style={{ ...inputStyle(t), marginTop: 6, maxWidth: 420 }}
            >
              {!stylesLoaded && <option value="">Loading styles…</option>}
              {styles.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i === 0 && styles.length > 1 ? '⭐ ' : ''}
                  {s.emoji ? `${s.emoji} ` : ''}
                  {s.name}
                  {s.voice ? ` · ${s.voice}` : ' · no voice set'}
                </option>
              ))}
            </select>
          )}
        </div>

        {path === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FieldLabel>Start from a video or article</FieldLabel>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  continueWithUrl();
                }
              }}
              disabled={busy}
              data-testid="own-script-import-url"
              placeholder="Paste a YouTube link, an article URL, or a PDF"
              style={inputStyle(t)}
            />
            <div style={{ fontSize: 12, color: t.textFaint, lineHeight: 1.5 }}>
              Next step reads the video&rsquo;s own captions, word for word. Free, instant. Videos with no captions get transcribed instead.
            </div>
          </div>
        )}

        {path === 'own' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FieldLabel right={words > 0 ? `${words} words ≈ ${(words / WORDS_PER_MINUTE).toFixed(1)} min` : undefined}>
              Paste your script
            </FieldLabel>
            <textarea
              value={script}
              onChange={(e) => {
                setScript(e.target.value);
                if (error) setError(null);
              }}
              disabled={busy}
              data-testid="own-script-textarea"
              rows={10}
              placeholder="Paste your script here. You land on the same editor as generate-from-video — edit, generate a new draft, or approve as-is."
              style={{
                ...inputStyle(t, { minHeight: 200, resize: 'vertical', lineHeight: 1.55, fontSize: 15, padding: 16 }),
                border: `2px solid ${JELLY_TOKENS.brandOutline}`,
                background: t.panel,
              }}
            />
          </div>
        )}

        {path === 'jelly' && (
          <div style={{ fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6 }}>
            Jelly writes on the editor&rsquo;s Script step from your title and notes. Nothing is written or charged until you press Generate there.
          </div>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <StepActions
          left={
            <button
              type="button"
              data-testid="source-batch"
              onClick={() => setBatchOpen(true)}
              disabled={busy}
              style={{ background: 'none', border: 'none', padding: 0, color: t.link, cursor: 'pointer', fontSize: 12.5, fontFamily: JELLY_TOKENS.font, textDecoration: 'underline' }}
            >
              Batch (up to 10 scripts) →
            </button>
          }
        >
          {path === 'video' && (
            <VBtn onClick={continueWithUrl} disabled={busy || !url.trim() || noStyles} data-testid="source-continue" icon="download">
              Read the video →
            </VBtn>
          )}
          {path === 'own' && (
            <VBtn onClick={() => void startWithOwnScript()} disabled={busy || words < 20 || noStyles} data-testid="source-use-script" icon="edit">
              {busy ? 'Starting…' : 'Use this script →'}
            </VBtn>
          )}
          {path === 'jelly' && (
            <VBtn onClick={() => void jellyWrites()} disabled={busy || noStyles} data-testid="source-jelly" icon="sparkle">
              {busy ? 'Opening…' : 'Open the editor →'}
            </VBtn>
          )}
        </StepActions>
      </StepCard>

      <StylePickerModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onProjectCreated={(projectId, step) => {
          setBatchOpen(false);
          openProjectInEditor(projectId, step);
        }}
      />
    </>
  );
}
