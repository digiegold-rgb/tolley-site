'use client';

/* PublishDecisionModal — "Post now, or schedule?" (2026-08-20).
 *
 * Every outbound post (Zernio socials, native YouTube) goes through this
 * explicit decision. The old UX hid an optional datetime field the eye
 * skipped, so posts went live instantly when the user meant to space them
 * out — a customer batch-producing 9 videos a week needs the ask every
 * time. Nothing is sent until the user confirms here.
 *
 * Portalled to <body> — fixed overlays inside <main> stack below the studio
 * chrome (2026-08-19 doctrine).
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface PublishDecisionModalProps {
  open: boolean;
  mode: 'social' | 'youtube';
  /** One line of context under the title — platforms picked, channel name. */
  contextLine?: string;
  busy?: boolean;
  /** scheduleIso === '' → post immediately. Otherwise an ISO timestamp. */
  onConfirm: (scheduleIso: string) => void;
  onClose: () => void;
}

export function PublishDecisionModal({
  open,
  mode,
  contextLine,
  busy,
  onConfirm,
  onClose,
}: PublishDecisionModalProps): React.ReactElement | null {
  const { t } = useTheme();
  const [choice, setChoice] = React.useState<'now' | 'schedule'>('now');
  const [when, setWhen] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setChoice('now');
      setWhen('');
    }
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  const minWhen = toLocalInputValue(new Date(Date.now() + 5 * 60_000));
  const whenMs = when ? new Date(when).getTime() : 0;
  const whenInPast = choice === 'schedule' && when !== '' && whenMs <= Date.now() + 60_000;
  const scheduleReady = choice === 'now' || (when !== '' && !whenInPast);

  const optionCard = (
    key: 'now' | 'schedule',
    emoji: string,
    title: string,
    blurb: string,
  ) => {
    const on = choice === key;
    return (
      <button
        type="button"
        onClick={() => setChoice(key)}
        aria-pressed={on}
        style={{
          flex: '1 1 200px',
          textAlign: 'left',
          padding: '12px 14px',
          borderRadius: JELLY_TOKENS.radius.lg,
          border: `1px solid ${on ? JELLY_TOKENS.brand : t.border}`,
          background: on ? JELLY_TOKENS.gradTicket : t.card,
          color: t.text,
          cursor: 'pointer',
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden="true">{emoji}</span>
          {title}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
          {blurb}
        </div>
      </button>
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Post now or schedule"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: t.panel,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.xxl,
          boxShadow: JELLY_TOKENS.shadow24,
          padding: 20,
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
          Post now, or schedule?
        </div>
        {contextLine && (
          <div style={{ fontSize: 12.5, color: t.textSecondary, marginTop: 4 }}>{contextLine}</div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
          {optionCard(
            'now',
            '⚡',
            'Post immediately',
            mode === 'youtube'
              ? 'Uploads and goes live as soon as YouTube finishes processing.'
              : 'Goes out to the selected accounts the moment you confirm.',
          )}
          {optionCard(
            'schedule',
            '📅',
            'Schedule for later',
            mode === 'youtube'
              ? 'Uploads private now; YouTube flips it public at your time.'
              : 'We hand it to the scheduler — it posts for you at your time.',
          )}
        </div>

        {choice === 'schedule' && (
          <div style={{ marginTop: 14 }}>
            <input
              type="datetime-local"
              value={when}
              min={minWhen}
              onChange={(e) => setWhen(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                fontSize: 15,
                fontFamily: JELLY_TOKENS.font,
                border: `1px solid ${whenInPast ? JELLY_TOKENS.error : t.borderStrong}`,
                borderRadius: JELLY_TOKENS.radius.md,
                background: t.card,
                color: t.text,
                outline: 'none',
                boxSizing: 'border-box',
                padding: 12,
              }}
            />
            <div
              style={{
                fontSize: 12,
                color: whenInPast ? JELLY_TOKENS.error : t.textSecondary,
                marginTop: 6,
                lineHeight: 1.5,
              }}
            >
              {whenInPast
                ? 'That time has passed — pick something at least a few minutes out.'
                : when
                  ? `Scheduled for ${new Date(when).toLocaleString()} (your local time).`
                  : 'Pick a date and time — e.g. next Monday 9:00 AM for a weekly cadence.'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <VBtn size="sm" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </VBtn>
          <VBtn
            size="sm"
            icon={choice === 'now' ? 'upload' : 'sparkle'}
            disabled={!scheduleReady || busy}
            onClick={() => onConfirm(choice === 'now' ? '' : new Date(when).toISOString())}
            style={{ background: scheduleReady && !busy ? JELLY_TOKENS.gradPrimary : undefined }}
            data-testid="publish-decision-confirm"
          >
            {busy
              ? 'Working…'
              : choice === 'now'
                ? 'Post now'
                : when
                  ? `Schedule · ${new Date(when).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                  : 'Schedule'}
          </VBtn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
