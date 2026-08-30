'use client';

/* Step 3 — Length. The slider from StylePickerModal (`target-minutes`),
 * 0 = match the source. Confirm SAVES length on the row and lands on the
 * Writing editor — it does not kick the DGX or charge. Generate is the
 * paid click on step 4.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { WORDS_PER_MINUTE, wordCountForDuration } from '@/lib/vater/youtube-types';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage } from '../create-api';
import { StepCard, Lede, FieldLabel, ErrorNote, StepActions, DoneSummary, wordsIn } from './step-ui';

export function LengthStep(): React.ReactElement {
  const { t } = useTheme();
  const flow = useCreateFlow();
  const { project, derived, readOnly } = flow;

  const sourceWords = wordsIn(project?.transcript);
  const [minutes, setMinutes] = React.useState(() => {
    const td = project?.targetDuration;
    return typeof td === 'number' && td > 0 ? td : 0;
  });
  React.useEffect(() => {
    const td = project?.targetDuration;
    if (typeof td === 'number' && td > 0) setMinutes(td);
  }, [project?.id, project?.targetDuration]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);

  const maxMinutes = Math.max(20, Math.ceil(sourceWords / WORDS_PER_MINUTE) + 2);
  const label =
    minutes === 0
      ? sourceWords > 0
        ? `Match the source · ~${sourceWords.toLocaleString()} words`
        : 'Match the source'
      : `${minutes} min · ~${wordCountForDuration(minutes).toLocaleString()} words`;

  // Lock only after generate/approve (Review+). Looking at step 3 from
  // Writing — or after we patched flowStep back to 3 — must show the slider.
  if (readOnly && project && derived && derived.step > 4) {
    const td = project.targetDuration;
    return (
      <DoneSummary onContinue={() => flow.goTo(derived.step)} continueLabel={`Continue to step ${derived.step} →`} testId="length-done">
        Length set to {td ? `${td} min · ~${wordCountForDuration(td).toLocaleString()} words` : 'match the source'}. To change it, rewrite the script on the Writing step.
      </DoneSummary>
    );
  }

  const confirm = async (): Promise<void> => {
    if (!project) return;
    if (sourceWords === 0) {
      setError('There is no transcript yet — go back to step 2.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const targetDuration =
        minutes > 0 ? minutes : Math.max(1, Math.ceil(sourceWords / WORDS_PER_MINUTE));
      const row = await createApi.patchProject(project.id, {
        targetDuration,
        flowStep: 4,
      });
      flow.adopt(row);
      flow.goTo(4);
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else {
        setError(errorMessage(err, 'Could not save the length'));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StepCard testId="length-step">
        <Lede>How long should the video be? The writer holds to this at {WORDS_PER_MINUTE} words per minute. You pick the model and see the quote on the next step — nothing is charged here.</Lede>
        <div>
          <FieldLabel right={<span data-testid="target-minutes-label">{label}</span>}>How long should the video be</FieldLabel>
          <input
            type="range"
            min={0}
            max={maxMinutes}
            step={1}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            disabled={busy}
            data-testid="target-minutes"
            aria-label="Target video length in minutes"
            style={{ width: '100%', accentColor: JELLY_TOKENS.brand, marginTop: 8 }}
          />
          <div style={{ fontSize: 11.5, color: t.textFaint, marginTop: 4, lineHeight: 1.5 }}>
            {minutes === 0
              ? 'Leave it here and the rewrite keeps the source’s own length. Drag to set a target instead.'
              : `Converted at ${WORDS_PER_MINUTE} words per minute — the same figure the writer is held to.`}
          </div>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <StepActions
          left={
            <span style={{ fontSize: 12, color: t.textFaint }}>
              Next step quotes the writer from published token rates. You approve before anything renders.
            </span>
          }
        >
          <VBtn onClick={() => void confirm()} disabled={busy || !project} data-testid="length-confirm" icon="sparkle">
            {busy ? 'Saving…' : 'Continue to script →'}
          </VBtn>
        </StepActions>
      </StepCard>
      <BillingBlockModal reason={block} context={blockCtx} projectId={project?.id} onClose={() => setBlock(null)} />
    </>
  );
}
