'use client';

/* HelpDrawer — right-side slide-over opened by the Help FAB and the
 * Dashboard "Getting Started" tutorial card.
 *
 * Before this, the FAB had no onClick at all and the how-it-works / FAQ copy
 * existed only on the signed-out landing page, so a paying customer had
 * nowhere to go when stuck. Copy is shared via lib/vater/help-content.ts.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { useTier } from './tier-context';
import { Icon } from './Icon';
import { VBtn } from './primitives';
import {
  PIPELINE_STEPS,
  HELP_FAQ,
  HELP_SUPPORT_EMAIL,
} from '@/lib/vater/help-content';

export interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  onGoBilling: () => void;
}

export function HelpDrawer({
  open,
  onClose,
  onGoBilling,
}: HelpDrawerProps): React.ReactElement | null {
  const { t } = useTheme();
  const { capabilities } = useTier();
  const panelRef = React.useRef<HTMLDivElement | null>(null);

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
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
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

          <section>
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
              Common questions
            </div>
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
            Email support
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
