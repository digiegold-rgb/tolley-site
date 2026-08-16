'use client';

/* HelpDrawer — right-side slide-over opened by the Help FAB, the Dashboard
 * "Getting Started" tutorial card, and the header version pill.
 *
 * Before this, the FAB had no onClick at all and the how-it-works / FAQ copy
 * existed only on the signed-out landing page, so a paying customer had
 * nowhere to go when stuck. Copy is shared via lib/vater/help-content.ts.
 *
 * Three sections, in reading order: how the pipeline works, what shipped
 * recently (lib/vater/changelog.ts), common questions, and a feedback form
 * that files a real ticket on the /hq queue rather than opening a mail client
 * and hoping.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { useTier } from './tier-context';
import { Icon } from './Icon';
import { VBtn } from './primitives';
import { devError } from './log';
import {
  PIPELINE_STEPS,
  HELP_FAQ,
  HELP_SUPPORT_EMAIL,
} from '@/lib/vater/help-content';
import { APP_VERSION, CHANGELOG } from '@/lib/vater/changelog';

/** Which section the drawer scrolls to when it opens. */
export type HelpFocus = 'whats-new' | 'feedback' | null;

export interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  onGoBilling: () => void;
  /** Scroll target on open — set by the header version pill. */
  focus?: HelpFocus;
  /** Current screen, attached to a report when the user opts in. */
  route?: string;
  /** Currently-open project, attached to a report when the user opts in. */
  projectId?: string | null;
}

export function HelpDrawer({
  open,
  onClose,
  onGoBilling,
  focus = null,
  route,
  projectId,
}: HelpDrawerProps): React.ReactElement | null {
  const { t } = useTheme();
  const { capabilities } = useTier();
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const whatsNewRef = React.useRef<HTMLDivElement | null>(null);
  const feedbackRef = React.useRef<HTMLDivElement | null>(null);

  // Escape closes; light focus trap keeps Tab inside the panel.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = panelRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // Move focus into the panel on open.
    const id = window.setTimeout(() => {
      panelRef.current
        ?.querySelector<HTMLElement>('button, a[href]')
        ?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(id);
    };
  }, [open, onClose]);

  // Scroll to the requested section AFTER the focus() above, which otherwise
  // yanks the scroll container back to the close button at the top.
  React.useEffect(() => {
    if (!open || !focus) return;
    const id = window.setTimeout(() => {
      const target = focus === 'feedback' ? feedbackRef.current : whatsNewRef.current;
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 40);
    return () => window.clearTimeout(id);
  }, [open, focus]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 250,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        data-testid="help-drawer"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(440px, 100vw)',
          maxWidth: '100vw',
          height: '100%',
          background: t.card,
          borderLeft: `1px solid ${t.border}`,
          boxShadow: JELLY_TOKENS.shadow24,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: `1px solid ${t.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>
            How Jelly works
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <Icon name="close" size={20} color={t.textSecondary} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PIPELINE_STEPS.map((s) => (
              <div key={s.n} style={{ display: 'flex', gap: 12 }}>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: 700,
                    color: JELLY_TOKENS.brand,
                    paddingTop: 2,
                    flexShrink: 0,
                  }}
                >
                  {s.n}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {s.t}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: t.textSecondary,
                      lineHeight: 1.6,
                      marginTop: 2,
                    }}
                  >
                    {s.d}
                  </div>
                </div>
              </div>
            ))}
          </section>

          <WhatsNewSection ref={whatsNewRef} />

          <section>
            <SectionLabel>Common questions</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {HELP_FAQ.map((f) => (
                <div key={f.q}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {f.q}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: t.textSecondary,
                      lineHeight: 1.6,
                      marginTop: 4,
                    }}
                  >
                    {f.a}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <FeedbackSection ref={feedbackRef} route={route} projectId={projectId} />
        </div>

        <div
          style={{
            flexShrink: 0,
            borderTop: `1px solid ${t.border}`,
            padding: 16,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <VBtn size="sm" onClick={onGoBilling}>
            Billing
          </VBtn>
          <a
            href={`mailto:${HELP_SUPPORT_EMAIL}?subject=Jelly%20Studio%20support`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 16px',
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${t.border}`,
              color: t.text,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              fontFamily: JELLY_TOKENS.font,
            }}
          >
            {HELP_SUPPORT_EMAIL}
          </a>
          {capabilities.rules && (
            <a
              href="/api/vater/rules"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                color: t.text,
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              Rules PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Section label ─── */

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: t.textSecondary,
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

/* ─── What's new ───────────────────────────────────────────────────────────
 * Reads lib/vater/changelog.ts directly — no fetch, so the panel is correct
 * the instant it opens and can't show a stale cached list. The public
 * GET /api/vater/changelog serves the same array to anything outside the app.
 */

const WhatsNewSection = React.forwardRef<HTMLDivElement>(
  function WhatsNewSection(_props, ref): React.ReactElement {
    const { t } = useTheme();
    return (
      <section ref={ref} data-testid="whats-new">
        <SectionLabel>What&apos;s new</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {CHANGELOG.map((entry) => {
            const current = entry.version === APP_VERSION;
            return (
              <div key={entry.version}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: JELLY_TOKENS.radius.full,
                      color: current ? '#fff' : t.textSecondary,
                      background: current ? JELLY_TOKENS.brand : t.cardAlt,
                      border: `1px solid ${current ? 'transparent' : t.border}`,
                    }}
                  >
                    v{entry.version}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {entry.title}
                  </span>
                  <span style={{ fontSize: 11, color: t.textSecondary }}>
                    {entry.date}
                  </span>
                </div>
                <ul
                  style={{
                    margin: '8px 0 0',
                    paddingLeft: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                  }}
                >
                  {entry.items.map((item) => (
                    <li
                      key={item}
                      style={{
                        fontSize: 13,
                        color: t.textSecondary,
                        lineHeight: 1.6,
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    );
  },
);

/* ─── Feedback ─────────────────────────────────────────────────────────────
 * POST /api/vater/feedback files a MustCompleteItem on the /hq queue and
 * pings Telegram. The user gets a ticket id back, so "I reported this" is a
 * checkable claim rather than a hope that an email was read.
 */

interface FeedbackSectionProps {
  route?: string;
  projectId?: string | null;
}

const FeedbackSection = React.forwardRef<HTMLDivElement, FeedbackSectionProps>(
  function FeedbackSection({ route, projectId }, ref): React.ReactElement {
    const { t } = useTheme();
    const [message, setMessage] = React.useState('');
    const [includeContext, setIncludeContext] = React.useState(true);
    const [sending, setSending] = React.useState(false);
    const [ticketId, setTicketId] = React.useState<string | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const submit = async (): Promise<void> => {
      const text = message.trim();
      if (!text || sending) return;
      setSending(true);
      setError(null);
      try {
        const res = await fetch('/api/vater/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            route: includeContext ? (route ?? null) : null,
            projectId: includeContext ? (projectId ?? null) : null,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ticketId?: string;
          error?: string;
        };
        if (!res.ok) {
          setError(data.error || `Could not send (${res.status}).`);
          return;
        }
        setTicketId(data.ticketId ?? null);
        setMessage('');
      } catch (err) {
        devError('[HelpDrawer] feedback submit failed', err);
        setError('Network error — your report was not sent. Try again.');
      } finally {
        setSending(false);
      }
    };

    return (
      <section ref={ref} data-testid="help-feedback">
        <SectionLabel>Report a problem / Send feedback</SectionLabel>
        {ticketId ? (
          <div
            data-testid="feedback-sent"
            style={{
              padding: 14,
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${JELLY_TOKENS.brandOutline}`,
              background: JELLY_TOKENS.brandGhost,
              fontSize: 13,
              lineHeight: 1.6,
              color: t.text,
            }}
          >
            Sent — ticket #{ticketId.slice(-8)}. It is on the queue now; you
            will hear back at the email on your account.
            <button
              type="button"
              onClick={() => setTicketId(null)}
              style={{
                display: 'block',
                marginTop: 10,
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: JELLY_TOKENS.brand,
                fontFamily: JELLY_TOKENS.font,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Send another
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="What went wrong, or what would make this better?"
              aria-label="Feedback message"
              data-testid="feedback-message"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 12,
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.cardAlt,
                color: t.text,
                fontFamily: JELLY_TOKENS.font,
                fontSize: 13,
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: t.textSecondary,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                data-testid="feedback-include-context"
              />
              Include the screen I&apos;m on{projectId ? ' and this project' : ''}
            </label>
            {error && (
              <div style={{ fontSize: 12, color: JELLY_TOKENS.error, lineHeight: 1.5 }}>
                {error}
              </div>
            )}
            <VBtn
              size="sm"
              onClick={submit}
              disabled={sending || message.trim().length === 0}
              data-testid="feedback-submit"
            >
              {sending ? 'Sending…' : 'Send feedback'}
            </VBtn>
            <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
              This files a ticket we work from directly. Prefer email? Write{' '}
              {HELP_SUPPORT_EMAIL}.
            </div>
          </div>
        )}
      </section>
    );
  },
);
