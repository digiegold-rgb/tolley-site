/**
 * CinemaLegalShell — the Jelly Studio "cinema" chrome for the three public
 * legal documents (/animate/terms, /animate/privacy, /animate/beta).
 *
 * Deliberately NOT components/legal/legal-page-shell.tsx: that shell is shared
 * with T-Agent (/terms, /privacy, /security, /data-retention) and carries the
 * real-estate SaaS masthead. A Jelly customer must read the document they are
 * agreeing to inside the same room as the rest of the studio — same ink ground,
 * same glass, same violet/cyan pair, same footer.
 *
 * Server component. CinemaRoot pins the dark ThemeProvider for the client
 * primitives underneath, so everything here reads JELLY_TOKENS.dark directly —
 * a public page has no theme toggle, and this file has no hooks.
 */

import * as React from 'react';
import Link from 'next/link';

import { CinemaRoot, MicroLabel, PillButton } from '@/components/animate/cinema';
import { JELLY_TOKENS } from '@/components/animate/tokens';
import { ANIMATE_LINKS } from '@/lib/legal-animate';
import { APP_VERSION } from '@/lib/vater/changelog';

const t = JELLY_TOKENS.dark;

/** Page width for the whole surface — nav, document, footer share one gutter. */
const SHELL_MAX = 1160;
/** The document column. 880px keeps legal prose at a readable measure. */
const DOC_MAX = 880;

const NAV_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Terms', href: ANIMATE_LINKS.terms },
  { label: 'Privacy', href: ANIMATE_LINKS.privacy },
  { label: 'Beta', href: ANIMATE_LINKS.beta },
];

const gutter: React.CSSProperties = {
  maxWidth: SHELL_MAX,
  margin: '0 auto',
  padding: '0 clamp(18px, 4vw, 32px)',
};

export interface CinemaLegalShellProps {
  title: string;
  subtitle: string;
  /** Micro-label above the title. */
  kicker?: string;
  children: React.ReactNode;
}

export function CinemaLegalShell({
  title,
  subtitle,
  kicker = 'JELLY STUDIO — LEGAL',
  children,
}: CinemaLegalShellProps): React.ReactElement {
  return (
    <CinemaRoot className="jc-legal" beam={false} density="sparse">
      {/* ── nav strip ─────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: t.headerBg,
          backdropFilter: t.glassBlur,
          WebkitBackdropFilter: t.glassBlur,
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <nav
          style={{
            ...gutter,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            minHeight: 66,
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/animate"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              textDecoration: 'none',
              color: t.text,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/animate/brand/logo.svg"
              alt=""
              width={30}
              height={30}
              style={{
                width: 30,
                height: 30,
                display: 'block',
                filter: 'drop-shadow(0 0 12px rgba(143,125,255,0.55))',
              }}
            />
            <span
              style={{
                fontFamily: JELLY_TOKENS.font,
                fontWeight: 700,
                fontSize: 13.5,
                letterSpacing: '0.12em',
                color: t.text,
                whiteSpace: 'nowrap',
              }}
            >
              JELLY STUDIO
            </span>
          </Link>

          <span style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="jc-nav-link"
                style={{
                  fontFamily: JELLY_TOKENS.font,
                  fontSize: 13.5,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {link.label}
              </Link>
            ))}
            <PillButton variant="ghost" size="sm" href="/animate">
              ← Back to studio
            </PillButton>
          </div>
        </nav>
      </header>

      {/* ── the document ──────────────────────────────────────────────── */}
      <main style={{ ...gutter, paddingTop: 'clamp(28px, 5vw, 52px)', paddingBottom: 72 }}>
        <article
          className="jc-fadein"
          style={{
            maxWidth: DOC_MAX,
            margin: '0 auto',
            background: t.card,
            border: `1px solid ${t.border}`,
            backdropFilter: t.glassBlur,
            WebkitBackdropFilter: t.glassBlur,
            borderRadius: JELLY_TOKENS.radius.xxl,
            boxShadow: t.cardShadow,
            padding: 'clamp(28px, 5vw, 40px)',
            fontFamily: JELLY_TOKENS.font,
            color: t.text,
          }}
        >
          <header
            style={{
              paddingBottom: 26,
              marginBottom: 30,
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <MicroLabel tone="cyan">{kicker}</MicroLabel>
            <h1
              style={{
                margin: '14px 0 0',
                fontFamily: JELLY_TOKENS.font,
                fontWeight: 600,
                fontSize: 'clamp(30px, 4vw, 44px)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                color: t.text,
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: '16px 0 0',
                maxWidth: 660,
                fontSize: 15.5,
                lineHeight: 1.7,
                color: t.textSecondary,
              }}
            >
              {subtitle}
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>{children}</div>
        </article>
      </main>

      {/* ── footer ────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${t.border}` }}>
        <div
          style={{
            ...gutter,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            paddingTop: 26,
            paddingBottom: 34,
          }}
        >
          <MicroLabel tone="faint" style={{ whiteSpace: 'normal' }}>
            Jelly Studio · Kansas City, MO
          </MicroLabel>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 18,
              fontFamily: JELLY_TOKENS.font,
              fontSize: 13,
              color: t.textFaint,
            }}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="jc-nav-link"
                style={{ textDecoration: 'none' }}
              >
                {link.label}
              </Link>
            ))}
            <span>v{APP_VERSION} · public beta</span>
          </div>
        </div>
      </footer>
    </CinemaRoot>
  );
}

/* ── the masthead facts block ─────────────────────────────────────────────
 * Service / Operator / Effective / Last updated / Contact — the same six-ish
 * rows sit at the top of all three documents. Kept here so the three pages
 * cannot drift apart; the rows themselves stay in the page files, because the
 * labels differ per document (Terms shows an address, Privacy shows hosting). */

export interface CinemaLegalMetaProps {
  rows: ReadonlyArray<{ label: string; value: React.ReactNode }>;
}

export function CinemaLegalMeta({ rows }: CinemaLegalMetaProps): React.ReactElement {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: JELLY_TOKENS.radius.xl,
        padding: 20,
      }}
    >
      {rows.map((row) => (
        <div key={row.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <MicroLabel tone="faint" size={10.5} style={{ whiteSpace: 'normal' }}>
            {row.label}
          </MicroLabel>
          <span
            style={{
              fontFamily: JELLY_TOKENS.font,
              fontSize: 14,
              lineHeight: 1.6,
              color: t.text,
            }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </section>
  );
}
