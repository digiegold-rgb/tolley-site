/**
 * CinemaLegalSection — one numbered clause of a Jelly Studio legal document,
 * drawn in the cinema language.
 *
 * Takes the SAME `LegalSectionContent` shape as components/legal/legal-section
 * (which stays untouched, because T-Agent's legal pages render it), so the
 * SECTIONS arrays in the three /animate pages did not have to change: only the
 * renderer did. `emphasis` becomes the ADMIT-ONE-adjacent ticket callout —
 * the violet/cyan tint reserved for the clauses a reader must not skim (money,
 * voices, prohibited uses, arbitration).
 *
 * Server component: no hooks, tokens read straight off JELLY_TOKENS.dark. The
 * three legal pages are public and dark-only; CinemaRoot pins the theme for the
 * client primitives around it.
 */

import * as React from 'react';

import { JELLY_TOKENS } from '@/components/animate/tokens';
import type { LegalSectionContent } from '@/components/legal/legal-section';

const t = JELLY_TOKENS.dark;

/** Body copy inside a clause. Exported so the page-level `children` blocks
 *  (links, tables, subprocessor lists) match the paragraphs around them
 *  without reaching for Tailwind colours that do not exist on this surface. */
export const LEGAL_BODY_STYLE: React.CSSProperties = {
  margin: 0,
  fontFamily: JELLY_TOKENS.font,
  fontSize: 15,
  lineHeight: 1.75,
  color: t.textSecondary,
};

/** The lead-in inside a paragraph ("California residents: ", "Service: "). */
export const LEGAL_STRONG_STYLE: React.CSSProperties = {
  color: t.text,
  fontWeight: 600,
};

/** In-prose link. Pair with `className="jc-link"` (which carries the violet
 *  colour and the hover rule) — legal prose keeps the underline permanently
 *  rather than only on hover. */
export const LEGAL_LINK_STYLE: React.CSSProperties = {
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  textDecorationColor: 'rgba(179,166,255,0.45)',
};

/** A nested glass row — retention rows, subprocessor cards, worked examples. */
export const LEGAL_ROW_STYLE: React.CSSProperties = {
  background: t.card,
  border: `1px solid ${t.border}`,
  borderRadius: JELLY_TOKENS.radius.lg,
  padding: 16,
};

export function CinemaLegalSection({
  heading,
  id,
  paragraphs,
  bullets,
  children,
  emphasis,
}: LegalSectionContent): React.ReactElement {
  const shell: React.CSSProperties = {
    scrollMarginTop: 96,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    fontFamily: JELLY_TOKENS.font,
  };

  if (emphasis) {
    shell.background = JELLY_TOKENS.gradTicket;
    shell.border = `1px solid ${JELLY_TOKENS.brandOutline}`;
    shell.borderRadius = JELLY_TOKENS.radius.xl;
    shell.padding = 20;
  }

  return (
    <section id={id} style={shell}>
      <h2
        style={{
          margin: 0,
          fontFamily: JELLY_TOKENS.font,
          fontSize: 17,
          fontWeight: 600,
          lineHeight: 1.35,
          letterSpacing: '-0.01em',
          color: t.text,
        }}
      >
        {heading}
      </h2>

      {paragraphs?.map((paragraph) => (
        <p key={paragraph} style={LEGAL_BODY_STYLE}>
          {paragraph}
        </p>
      ))}

      {bullets?.length ? (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {bullets.map((item) => (
            <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span
                aria-hidden="true"
                style={{
                  flex: 'none',
                  color: JELLY_TOKENS.brandLight,
                  fontSize: 11,
                  lineHeight: '26px',
                  opacity: 0.7,
                }}
              >
                ✦
              </span>
              <span style={LEGAL_BODY_STYLE}>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {children}
    </section>
  );
}
