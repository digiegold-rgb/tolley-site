'use client';

/* Talk to Claude — Review-step dialogue about the script in the box.
 * Each send is a new charge. Apply to editor is free (undo/history).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import {
  SCRIPT_WRITER_MODELS,
  formatScriptCents,
  type ScriptFidelity,
  type ScriptQuote,
  type ScriptWriterModelId,
} from '@/lib/vater/script-writer-models';
import {
  quoteScriptChat,
  readScriptChatState,
  type ScriptChatCharge,
  type ScriptChatTurn,
} from '@/lib/vater/script-chat';
import { SCRIPT_WRITER_FALLBACK_RULES } from '@/lib/vater/script-writer-copy';
import { notifyVaterBillingChanged } from '@/lib/vater/billing/client-refresh';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage, type CreateProject } from '../create-api';
import { ErrorNote, InfoNote, inputStyle } from './step-ui';

export interface TalkToClaudeProps {
  project: CreateProject;
  draft: string;
  model: ScriptWriterModelId;
  fidelity: ScriptFidelity;
  disabled?: boolean;
  onApplyScript: (script: string) => void;
}

export function TalkToClaude({
  project,
  draft,
  model,
  fidelity,
  disabled = false,
  onApplyScript,
}: TalkToClaudeProps): React.ReactElement {
  const { t } = useTheme();
  const flow = useCreateFlow();
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);
  const [turns, setTurns] = React.useState<ScriptChatTurn[]>(() => readScriptChatState(project.scriptMeta).turns);
  const [lastCharge, setLastCharge] = React.useState<ScriptChatCharge | null>(
    () => readScriptChatState(project.scriptMeta).lastCharge,
  );
  const [pendingApply, setPendingApply] = React.useState<string | null>(null);
  const [lastQuote, setLastQuote] = React.useState<ScriptQuote | null>(null);

  React.useEffect(() => {
    const state = readScriptChatState(project.scriptMeta);
    setTurns(state.turns);
    setLastCharge(state.lastCharge);
  }, [project.id, project.scriptMeta]);

  const quote = React.useMemo(
    () =>
      quoteScriptChat({
        model,
        script: draft,
        message: message.trim(),
        history: turns,
        fidelity,
        title: project.sourceTitle,
        rules: SCRIPT_WRITER_FALLBACK_RULES,
      }),
    [model, draft, message, turns, fidelity, project.sourceTitle],
  );

  const send = async (): Promise<void> => {
    const text = message.trim();
    if (text.length < 2 || busy || disabled) return;
    setBusy(true);
    setError(null);
    setPendingApply(null);
    try {
      setLastQuote(quote);
      const data = await createApi.talkScript(project.id, {
        message: text,
        script: draft,
        model,
        fidelity,
        requestId:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `talk_${Date.now()}_${model}`,
      });
      if (data.quote) setLastQuote(data.quote);
      if (data.charge) setLastCharge(data.charge);
      if (data.project) flow.adopt(data.project);
      const nextTurns = readScriptChatState(data.project?.scriptMeta).turns;
      if (nextTurns.length > 0) setTurns(nextTurns);
      else {
        setTurns((prev) => [
          ...prev,
          { role: 'user', text, at: new Date().toISOString() },
          {
            role: 'assistant',
            text: data.reply,
            at: new Date().toISOString(),
            billedCents: data.charge?.billedCents,
            quotedCents: data.charge?.quotedCents,
            revised: Boolean(data.revisedScript),
          },
        ]);
      }
      setPendingApply(data.revisedScript ?? null);
      setMessage('');
      notifyVaterBillingChanged();
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else {
        setError(errorMessage(err, 'Could not talk to Claude'));
      }
    } finally {
      setBusy(false);
    }
  };

  const apply = (): void => {
    if (!pendingApply) return;
    onApplyScript(pendingApply);
    setPendingApply(null);
  };

  const locked = disabled || busy;
  const canSend = !locked && message.trim().length >= 2;

  return (
    <>
      <div
        data-testid="talk-to-claude"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px 14px 12px',
          borderRadius: JELLY_TOKENS.radius.md,
          border: `1px solid ${JELLY_TOKENS.brandOutline}`,
          background: JELLY_TOKENS.brandGhost,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Talk to Claude</div>
          <div data-testid="talk-quote" style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
            {SCRIPT_WRITER_MODELS[model].label} · ≈ {formatScriptCents(quote.billedCents)}
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.5 }}>
          Talk is billed per send. Editing the box is free. Generate from video/draft is a
          separate charge.
        </div>

        {turns.length > 0 && (
          <div
            data-testid="talk-thread"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxHeight: 220,
              overflowY: 'auto',
              padding: '8px 10px',
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${t.border}`,
              background: t.card,
            }}
          >
            {turns.map((turn, i) => (
              <div key={`${turn.at}-${i}`} style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>
                <span style={{ fontWeight: 700, color: t.textSecondary, marginRight: 6 }}>
                  {turn.role === 'user' ? 'You' : 'Claude'}
                </span>
                {turn.text}
              </div>
            ))}
          </div>
        )}

        <textarea
          value={message}
          disabled={locked}
          data-testid="talk-message"
          aria-label="Message to Claude about this script"
          placeholder="Ask about this script, or tell Claude what to change…"
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          style={{
            ...inputStyle(t),
            minHeight: 72,
            resize: 'vertical',
            lineHeight: 1.5,
          }}
        />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <VBtn onClick={() => void send()} disabled={!canSend} data-testid="talk-send" icon="sparkle">
            {busy ? 'Talking…' : `Send · ${SCRIPT_WRITER_MODELS[model].label} · ≈ ${formatScriptCents(quote.billedCents)}`}
          </VBtn>
          {pendingApply && (
            <VBtn variant="outlined" onClick={apply} disabled={disabled} data-testid="talk-apply">
              Apply to editor
            </VBtn>
          )}
        </div>

        {lastCharge && (
          <InfoNote tone="brand" testId="talk-billed">
            Last talk · {SCRIPT_WRITER_MODELS[lastCharge.model].label} · estimate{' '}
            {formatScriptCents(lastCharge.quotedCents)} · charged {formatScriptCents(lastCharge.billedCents)}
            {lastQuote && lastQuote.model === lastCharge.model
              ? ` · this pick estimates ${formatScriptCents(lastQuote.billedCents)} next`
              : ''}
            .
          </InfoNote>
        )}
        {pendingApply && (
          <InfoNote testId="talk-apply-hint">
            Claude sent a revised script. Apply to editor is free — it goes through Undo / History.
            Chat-only answers never overwrite the box.
          </InfoNote>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
      <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
    </>
  );
}
