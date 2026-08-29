'use client';

/* Step 2 — Transcript. The free caption read (`importFromUrl` from
 * StylePickerModal) lives here. First success creates the row (same
 * new-from-style call the modal used) and PATCHes transcript + title + url +
 * flowStep 2, then scrolls the transcript box into view and offers the
 * "how long?" hand-off to step 3.
 *
 * No captions → the existing paid "Transcribe & rewrite" path
 * (POST /api/vater/youtube {url}) which whispers the audio on the DGX; the
 * row then pulses on this step until `transcribed`.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { FLAT_ACTION_PRICES, formatPrice } from '@/lib/vater/pricing';
import { STATUS_LABELS, type YouTubeProjectStatus } from '@/lib/vater/youtube-status';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage, ApiError } from '../create-api';
import { StepCard, Lede, FieldLabel, ErrorNote, InfoNote, StepActions, DoneSummary, PulseCard, inputStyle, wordsIn } from './step-ui';
import { NotifyOptInCard } from '../../../NotifyOptInCard';

const URL_RE = /^https?:\/\/\S+\.\S+/;

export function TranscriptStep(): React.ReactElement {
  const { t } = useTheme();
  const flow = useCreateFlow();
  const { project, derived, readOnly, styleId, pendingUrl } = flow;

  const [url, setUrl] = React.useState(pendingUrl || project?.sourceUrl || '');
  const [importing, setImporting] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [noCaptions, setNoCaptions] = React.useState(false);
  const [note, setNote] = React.useState<string | null>(null);
  const [justImported, setJustImported] = React.useState(false);
  const boxRef = React.useRef<HTMLTextAreaElement | null>(null);
  const autoRan = React.useRef(false);

  const transcript = project?.transcript ?? '';
  const hasTranscript = wordsIn(transcript) > 0;
  const words = wordsIn(transcript);

  const importFromUrl = React.useCallback(async (): Promise<void> => {
    const u = url.trim();
    if (!URL_RE.test(u)) {
      setError('Paste a full link first.');
      return;
    }
    setImporting(true);
    setError(null);
    setNoCaptions(false);
    setNote(null);
    try {
      const data = await createApi.importFromUrl(u);
      const n = data.words ?? wordsIn(data.text);
      let row = project;
      if (!row) {
        if (!styleId) throw new Error('Pick a style on step 1 first.');
        row = await createApi.createFromStyle(styleId);
      }
      const saved = await createApi.patchProject(row.id, {
        transcript: data.text,
        sourceTitle: (data.title || u).slice(0, 120),
        sourceUrl: u,
        flowStep: 2,
      });
      flow.adopt(saved);
      flow.setPendingUrl('');
      setNote(
        `Pulled ${n.toLocaleString()} words from ${data.source ?? 'that link'}` +
          (data.title ? ` — “${data.title.slice(0, 60)}”` : '') +
          '.',
      );
      setJustImported(true);
    } catch (err) {
      const nc =
        err instanceof ApiError &&
        (err.status === 422 || /transcript|caption|subtitle/i.test(err.message));
      setNoCaptions(nc);
      setError(
        nc
          ? 'This video has no captions to read. Use “Transcribe & rewrite” — it listens to the audio instead.'
          : errorMessage(err, 'Could not read that link'),
      );
    } finally {
      setImporting(false);
    }
  }, [url, project, styleId, flow]);

  // Arriving from step 1 with a queued URL: read it without another click.
  React.useEffect(() => {
    if (autoRan.current || hasTranscript || !pendingUrl || importing) return;
    autoRan.current = true;
    void importFromUrl();
  }, [pendingUrl, hasTranscript, importing, importFromUrl]);

  // The transcript box scrolls into view once the words land.
  React.useEffect(() => {
    if (!justImported || !boxRef.current) return;
    boxRef.current.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [justImported]);

  const transcribeAndRewrite = async (): Promise<void> => {
    const u = url.trim();
    if (!URL_RE.test(u)) {
      setError('Paste a full link first.');
      return;
    }
    setTranscribing(true);
    setError(null);
    try {
      const row = await createApi.transcribeUrl(u);
      flow.adopt(row);
      flow.setPendingUrl('');
    } catch (err) {
      setError(errorMessage(err, 'Could not start from that link'));
    } finally {
      setTranscribing(false);
    }
  };

  const continueToLength = async (): Promise<void> => {
    if (!project) return;
    setError(null);
    try {
      const saved = await createApi.patchProject(project.id, { flowStep: 3 });
      flow.adopt(saved);
      flow.goTo(3);
    } catch (err) {
      setError(errorMessage(err, 'Could not save your progress'));
    }
  };

  // ── Looking back from a later step ───────────────────────────────────────
  if (readOnly && project && derived) {
    return (
      <DoneSummary onContinue={() => flow.goTo(derived.step)} continueLabel={`Continue to step ${derived.step} →`} testId="transcript-done">
        {words.toLocaleString()} words transcribed{project.sourceTitle ? ` from “${project.sourceTitle}”` : ''}.
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer', color: t.textSecondary, fontSize: 13 }}>Show the transcript</summary>
          <textarea readOnly value={transcript} rows={10} data-testid="transcript-box" style={{ ...inputStyle(t, { marginTop: 8, resize: 'vertical', lineHeight: 1.55 }) }} />
        </details>
      </DoneSummary>
    );
  }

  // ── The DGX is transcribing (paid whisper path) ─────────────────────────
  if (project && derived?.step === 2 && derived.kind === 'async') {
    return (
      <PulseCard
        title="Transcribing your video…"
        line={STATUS_LABELS[project.status as YouTubeProjectStatus] ?? project.status}
        testId="transcript-pulse"
      >
        <div style={{ fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6 }}>
          Listening to the audio and writing it down. You can leave — the Progress tab will light up and we&rsquo;ll email you.
        </div>
        <NotifyOptInCard compact />
      </PulseCard>
    );
  }

  // ── Transcript in hand → the length hand-off ─────────────────────────────
  if (project && hasTranscript) {
    return (
      <>
        <StepCard testId="transcript-step">
          {note && <InfoNote testId="own-script-import-note">{note}</InfoNote>}
          <FieldLabel right={`${words.toLocaleString()} words`}>Transcript · the source, not the script</FieldLabel>
          <textarea
            ref={boxRef}
            readOnly
            value={transcript}
            rows={12}
            data-testid="transcript-box"
            style={inputStyle(t, { resize: 'vertical', lineHeight: 1.55, minHeight: 220 })}
          />
          {error && <ErrorNote>{error}</ErrorNote>}
        </StepCard>
        <StepCard variant="ticket" testId="transcript-next">
          <div style={{ fontSize: 18, fontWeight: 600, color: t.text, letterSpacing: '-0.01em' }}>
            Your script is transcribed. How long should your personalized video be?
          </div>
          <Lede>Next you set the length — Jelly rewrites these words into your script at that length, under your rules.</Lede>
          <StepActions>
            <VBtn onClick={() => void continueToLength()} data-testid="transcript-continue" icon="chevronRight">
              Continue →
            </VBtn>
          </StepActions>
        </StepCard>
      </>
    );
  }

  // ── Nothing read yet (or the DGX transcribe failed) ─────────────────────
  const failedHere = project && derived?.kind === 'failed' && derived.step === 2;
  return (
    <StepCard testId="transcript-step">
      <Lede>Reading the video&rsquo;s own captions, word for word. Free, instant.</Lede>
      {failedHere && (
        <ErrorNote testId="transcript-failed">
          Transcription failed{project?.errorMessage ? `: ${project.errorMessage}` : ''}. Try the link again, or a different one.
        </ErrorNote>
      )}
      <FieldLabel>Video or article link</FieldLabel>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !importing) {
              e.preventDefault();
              void importFromUrl();
            }
          }}
          disabled={importing || transcribing}
          data-testid="own-script-import-url"
          placeholder="Paste a YouTube link, an article URL, or a PDF"
          style={inputStyle(t, { flex: '1 1 220px', minWidth: 180, width: 'auto' })}
        />
        <VBtn
          size="sm"
          icon="download"
          onClick={() => void importFromUrl()}
          disabled={importing || transcribing || !url.trim()}
          data-testid="own-script-import-btn"
          className={URL_RE.test(url.trim()) && !importing ? 'jelly-pulse' : undefined}
        >
          {importing ? 'Reading…' : 'Get the text'}
        </VBtn>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {(noCaptions || failedHere) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <VBtn
            size="sm"
            variant="outlined"
            onClick={() => void transcribeAndRewrite()}
            disabled={importing || transcribing || !url.trim()}
            data-testid="own-script-rewrite-btn"
          >
            {transcribing ? 'Starting…' : 'Transcribe & rewrite'}
          </VBtn>
          <span style={{ fontSize: 12, color: t.textFaint, lineHeight: 1.5 }}>
            For videos with no captions. Listens to the audio first.{' '}
            {formatPrice(FLAT_ACTION_PRICES.transcription.priceCents)} {FLAT_ACTION_PRICES.transcription.unit}.
          </span>
        </div>
      )}
      <div style={{ fontSize: 12, color: t.textFaint }}>
        <button
          type="button"
          onClick={() => flow.goTo(1)}
          style={{ background: 'none', border: 'none', padding: 0, color: t.link, cursor: 'pointer', fontSize: 12, fontFamily: JELLY_TOKENS.font, textDecoration: 'underline' }}
        >
          ← Back to Source
        </button>
      </div>
    </StepCard>
  );
}
