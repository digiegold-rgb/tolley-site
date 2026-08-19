'use client';

/* EngineBar — the engine choice for a project that already HAS a script but
 * nothing rendered yet. Sits between the stepper and the step content in
 * ProjectShell.
 *
 *   Jelly Auto  → nothing to send; the steps below kick the pipeline as
 *                 they always did (Voiceover / Visuals).
 *   Fable 5     → "Send to Fable 5" → POST /api/vater/youtube/[id]/concierge
 *                 with no body (the saved script is the ticket's script).
 *
 * 402 goes through the shared BillingBlock wall; every other failure is an
 * inline message. The estimate is the same number the Visuals step quotes.
 */

import * as React from 'react';
import { JELLY_TOKENS, glass } from '../tokens';
import { useTheme } from '../theme-context';
import { VBtn } from '../primitives';
import { MicroLabel } from '../cinema';
import { TINT_BG } from '../screens/tint';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockContext,
  type BillingBlockReason,
} from '../screens/editor/BillingBlock';
import { useRenderEstimate } from '../screens/editor/use-render-estimate';
import { EnginePicker, type ConciergeEngine } from './EnginePicker';

export interface EngineBarProps {
  projectId: string;
  /** Word count of the saved script, for the quote line. */
  words: number;
  refresh: () => Promise<void>;
}

export function EngineBar({ projectId, words, refresh }: EngineBarProps): React.ReactElement {
  const { t } = useTheme();
  const [engine, setEngine] = React.useState<ConciergeEngine>('auto');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [billingCtx, setBillingCtx] = React.useState<BillingBlockContext | undefined>(undefined);
  const estimate = useRenderEstimate(projectId);

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await assertOk(res);
      await refresh();
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
        setBillingCtx(err.context);
      } else {
        setError(err instanceof Error ? err.message : 'Could not send to Fable 5');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      data-testid="engine-bar"
      style={{
        maxWidth: 700,
        margin: '0 auto 20px',
        padding: 14,
        ...glass(t),
        borderRadius: JELLY_TOKENS.radius.xl,
        fontFamily: JELLY_TOKENS.font,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <MicroLabel tone="violet" size={10.5}>
          Engine
        </MicroLabel>
        <span style={{ fontSize: 13, color: t.textSecondary }}>
          Your script is ready — who renders it?
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: t.textFaint, fontFamily: JELLY_TOKENS.fontMono }}>
          {words.toLocaleString()} words · ~{Math.max(1, Math.ceil(words / 150))} min
        </span>
      </div>
      <EnginePicker
        value={engine}
        onChange={(e) => {
          setEngine(e);
          setError(null);
        }}
        estimateUsd={estimate.draftUsd}
        estimateLoading={estimate.loading}
        disabled={sending}
        compact
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: t.textSecondary, flex: '1 1 240px' }}>
          {engine === 'fable5'
            ? 'Fable 5 takes it from here — you get an email when it lands in your Library.'
            : 'Continue with the steps below — Voiceover and Visuals render on the Jelly pipeline now.'}
        </span>
        {engine === 'fable5' && (
          <VBtn
            variant="primary"
            size="sm"
            icon="sparkle"
            onClick={() => void send()}
            disabled={sending}
            data-testid="engine-bar-send"
          >
            {sending ? 'Sending…' : 'Send to Fable 5'}
          </VBtn>
        )}
      </div>
      {error && (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: '8px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            ...TINT_BG.error,
            color: JELLY_TOKENS.error,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
      <BillingBlockModal
        reason={billingBlock}
        context={billingCtx}
        projectId={projectId}
        onClose={() => setBillingBlock(null)}
      />
    </div>
  );
}
