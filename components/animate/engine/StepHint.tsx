'use client';

/* StepHint — a tiny "?" that explains a step or a choice.
 *
 * Hover + focus show it, tap toggles it (touch has no hover), Escape closes,
 * click-outside closes. No library: one React.useId() for aria-describedby,
 * one fixed-position bubble so it never gets clipped by an overflow parent.
 * Inline styles only, cinema tokens only.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { useTheme } from '../theme-context';

export interface StepHintProps {
  /** The tooltip body. Plain text or a small React fragment. */
  text: React.ReactNode;
  /** Accessible label for the trigger. Defaults to "What is this?". */
  label?: string;
  /** Custom trigger. Default: a 16px "?" circle. */
  children?: React.ReactNode;
  /** Bubble width. */
  width?: number;
  /** Preferred side. Falls back automatically near the viewport edge. */
  side?: 'top' | 'bottom';
  style?: React.CSSProperties;
}

export function StepHint({
  text,
  label = 'What is this?',
  children,
  width = 260,
  side = 'top',
  style,
}: StepHintProps): React.ReactElement {
  const { t } = useTheme();
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [pinned, setPinned] = React.useState(false);
  const [pos, setPos] = React.useState<{ left: number; top: number; place: 'top' | 'bottom' } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  const show = open || pinned;

  const place = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const margin = 8;
    const left = Math.min(Math.max(margin, r.left + r.width / 2 - width / 2), vw - width - margin);
    const wantTop = side === 'top' && r.top > 160;
    const placeAt: 'top' | 'bottom' = wantTop ? 'top' : 'bottom';
    setPos({ left, top: placeAt === 'top' ? r.top - 8 : r.bottom + 8, place: placeAt });
  }, [side, width]);

  React.useEffect(() => {
    if (!show) return;
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setPinned(false);
      }
    };
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (triggerRef.current && e.target instanceof Node && triggerRef.current.contains(e.target)) return;
      setPinned(false);
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [show, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={show ? id : undefined}
        aria-expanded={show}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((p) => !p);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          cursor: 'help',
          color: t.textSecondary,
          fontFamily: JELLY_TOKENS.font,
          verticalAlign: 'middle',
          ...style,
        }}
      >
        {children ?? (
          <span
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: `1px solid ${show ? JELLY_TOKENS.brand : t.borderStrong}`,
              color: show ? JELLY_TOKENS.brand : t.textSecondary,
              fontSize: 10.5,
              fontWeight: 700,
              lineHeight: '14px',
              textAlign: 'center',
              display: 'inline-block',
              transition: 'all .15s ease',
            }}
          >
            ?
          </span>
        )}
      </button>
      {show && pos && (
        <div
          role="tooltip"
          id={id}
          style={{
            position: 'fixed',
            left: pos.left,
            top: pos.top,
            transform: pos.place === 'top' ? 'translateY(-100%)' : undefined,
            width,
            zIndex: 1200,
            padding: '10px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            background: t.panel,
            color: t.text,
            border: `1px solid ${t.borderStrong}`,
            boxShadow: JELLY_TOKENS.shadow4,
            fontSize: 12.5,
            lineHeight: 1.45,
            fontFamily: JELLY_TOKENS.font,
            fontWeight: 400,
            textAlign: 'left',
            pointerEvents: 'none',
            whiteSpace: 'normal',
          }}
        >
          {text}
        </div>
      )}
    </>
  );
}
