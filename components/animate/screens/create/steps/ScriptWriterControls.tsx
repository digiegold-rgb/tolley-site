'use client';

/* Model picker + quote + generate for the Create Video script editor.
 * Shared by Writing (step 4) and Review (step 5) so both start doors
 * (own script / from video) iterate the same way.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { useTier } from '../../../tier-context';
import { VBtn } from '../../../primitives';
import {
  SCRIPT_FIDELITIES,
  SCRIPT_FIDELITY_HINTS,
  SCRIPT_FIDELITY_LABELS,
  SCRIPT_WRITER_MODELS,
  SCRIPT_WRITER_MODEL_IDS,
  estimateTokensFromText,
  formatScriptCents,
  quoteScriptUsage,
  readLastScriptCharge,
  resolveScriptWriterModel,
  storeScriptWriterModel,
  type ScriptFidelity,
  type ScriptQuote,
  type ScriptWriterModelId,
  type ScriptWriterSource,
} from '@/lib/vater/script-writer-models';
import { WORDS_PER_MINUTE } from '@/lib/vater/youtube-types';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage, type CreateProject } from '../create-api';
import { FieldLabel, ErrorNote, InfoNote, inputStyle, wordsIn } from './step-ui';

const FALLBACK_RULES_HINT =
  'Genuine rewrite, not a rephrase. Script Rules pack. Spoken narration in the speaker voice.';

/** Same meter as the server quote; rules length is a published-size stand-in. */
function clientQuote(model: ScriptWriterModelId, source: string, targetWords: number): ScriptQuote {
  const input = estimateTokensFromText(FALLBACK_RULES_HINT) + estimateTokensFromText(source) + 80;
  const output = Math.max(1, Math.ceil(Math.max(80, targetWords) * 1.3));
  return quoteScriptUsage(model, input, output);
}

export interface ScriptWriterControlsProps {
  project: CreateProject;
  draft: string;
  disabled?: boolean;
  onGenerated: (project: CreateProject) => void;
}

export function ScriptWriterControls({
  project,
  draft,
  disabled = false,
  onGenerated,
}: ScriptWriterControlsProps): React.ReactElement {
  const { t } = useTheme();
  const { email } = useTier();
  const flow = useCreateFlow();
  const [model, setModel] = React.useState<ScriptWriterModelId>(() => resolveScriptWriterModel(email));
  const [fidelity, setFidelity] = React.useState<ScriptFidelity>('balanced');
  const [busy, setBusy] = React.useState<ScriptWriterSource | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);
  const [lastQuote, setLastQuote] = React.useState<ScriptQuote | null>(null);

  React.useEffect(() => {
    setModel(resolveScriptWriterModel(email));
  }, [email]);

  const pickModel = (id: ScriptWriterModelId): void => {
    setModel(id);
    storeScriptWriterModel(id);
  };

  const transcriptWords = wordsIn(project.transcript);
  const draftWords = wordsIn(draft);
  const targetWords =
    project.targetWordCount > 0
      ? project.targetWordCount
      : project.targetDuration > 0
        ? project.targetDuration * WORDS_PER_MINUTE
        : Math.max(draftWords, transcriptWords, 80);

  const transcriptQuote = React.useMemo(
    () => (transcriptWords >= 20 ? clientQuote(model, project.transcript ?? '', targetWords) : null),
    [model, project.transcript, targetWords, transcriptWords],
  );
  const editedQuote = React.useMemo(
    () => (draftWords >= 20 ? clientQuote(model, draft, targetWords) : null),
    [model, draft, targetWords, draftWords],
  );

  const lastCharge = readLastScriptCharge(project.scriptMeta);

  const generate = async (source: ScriptWriterSource): Promise<void> => {
    setBusy(source);
    setError(null);
    try {
      const preview = source === 'edited' ? editedQuote : transcriptQuote;
      if (preview) setLastQuote(preview);
      const data = await createApi.writeScript(project.id, {
        model,
        fidelity,
        source,
        requestId:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `click_${Date.now()}_${source}_${model}`,
        ...(source === 'edited' ? { editedScript: draft } : {}),
      });
      if (data.quote) setLastQuote(data.quote);
      if (data.project) {
        onGenerated(data.project);
        flow.adopt(data.project);
      }
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else {
        setError(errorMessage(err, 'Could not generate the script'));
      }
    } finally {
      setBusy(null);
    }
  };

  const locked = disabled || busy !== null;

  return (
    <>
      <div data-testid="script-writer" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <FieldLabel>Writer model</FieldLabel>
        <div
          role="radiogroup"
          aria-label="Script writer model"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}
        >
          {SCRIPT_WRITER_MODEL_IDS.map((id) => {
            const spec = SCRIPT_WRITER_MODELS[id];
            const on = model === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={locked}
                data-testid={`script-model-${id}`}
                onClick={() => pickModel(id)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: JELLY_TOKENS.radius.md,
                  border: `1px solid ${on ? JELLY_TOKENS.brandOutline : t.border}`,
                  background: on ? JELLY_TOKENS.brandGhost : t.cardAlt,
                  color: t.text,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  fontFamily: JELLY_TOKENS.font,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>{spec.label}</div>
                <div style={{ fontSize: 11.5, color: t.textSecondary, marginTop: 3, lineHeight: 1.4 }}>{spec.blurb}</div>
              </button>
            );
          })}
        </div>

        <FieldLabel>How far from the source</FieldLabel>
        <select
          value={fidelity}
          disabled={locked}
          data-testid="script-fidelity"
          aria-label="How close to keep the script to the source"
          onChange={(e) => setFidelity(e.target.value as ScriptFidelity)}
          style={{ ...inputStyle(t), width: 'auto', minWidth: 260 }}
        >
          {SCRIPT_FIDELITIES.map((f) => (
            <option key={f} value={f}>
              {SCRIPT_FIDELITY_LABELS[f]}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 12, color: t.textFaint, lineHeight: 1.5 }}>{SCRIPT_FIDELITY_HINTS[fidelity]}</div>

        <div
          data-testid="script-quote"
          style={{
            fontSize: 13,
            color: t.text,
            lineHeight: 1.55,
            padding: '10px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${t.border}`,
            background: t.cardAlt,
          }}
        >
          <div>
            Estimate ({SCRIPT_WRITER_MODELS[model].label}, ~{targetWords.toLocaleString()} words)
          </div>
          <div style={{ marginTop: 4, fontWeight: 600 }}>
            {transcriptQuote && (
              <span data-testid="script-quote-transcript">
                From transcript ≈ {formatScriptCents(transcriptQuote.billedCents)}
              </span>
            )}
            {transcriptQuote && editedQuote && <span style={{ color: t.textFaint }}> · </span>}
            {editedQuote && (
              <span data-testid="script-quote-edited">
                From the text in the box ≈ {formatScriptCents(editedQuote.billedCents)}
              </span>
            )}
            {!transcriptQuote && !editedQuote && <span>Import a source or paste a draft to see a quote.</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <VBtn
            onClick={() => void generate('transcript')}
            disabled={locked || !transcriptQuote}
            data-testid="script-generate-transcript"
            icon="sparkle"
          >
            {busy === 'transcript' ? 'Writing…' : 'Generate from the video'}
          </VBtn>
          <VBtn
            variant="outlined"
            onClick={() => void generate('edited')}
            disabled={locked || !editedQuote}
            data-testid="script-generate-edited"
            icon="edit"
          >
            {busy === 'edited' ? 'Writing…' : 'Generate from this draft'}
          </VBtn>
        </div>
        <div style={{ fontSize: 12, color: t.textFaint, lineHeight: 1.5 }}>
          Each generate is a new charge. Switching models and clicking again bills that run too.
        </div>

        {lastCharge && (
          <InfoNote tone="brand" testId="script-billed">
            Last run · {SCRIPT_WRITER_MODELS[lastCharge.model].label} · estimate{' '}
            {formatScriptCents(lastCharge.quotedCents)} · charged {formatScriptCents(lastCharge.billedCents)}
            {lastQuote && lastQuote.model === lastCharge.model
              ? ` · this pick estimates ${formatScriptCents(lastQuote.billedCents)} next`
              : ''}
            .
          </InfoNote>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
    </>
  );
}
