'use client';

/* Footer — the studio's end credits.
 *
 * Cinema pass (2026-08-16): a hairline top rule, a glass ground, and micro-set
 * type. The three link columns collapsed into one wrapped micro row plus a
 * bottom credit line ("JELLY STUDIO · KANSAS CITY, MO · v1.3 · public beta"),
 * which is what the landing footer does.
 *
 * Every link that was here is still here. `/animate/demo` in particular is
 * this page's only inbound static href — dropping it would make
 * scripts/audit-links.mjs call the signed-out demo an orphan.
 */

import * as React from 'react';
import { JELLY_TOKENS, glass } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { MicroLabel } from './cinema';
import { APP_VERSION } from '@/lib/vater/changelog';

type FooterLink = {
  label: string;
  /** Internal v2 route key — handled by RouteContext.setRoute. */
  route?: string;
  /** External URL — opens in a new tab. */
  href?: string;
  /** Same-origin path — uses normal navigation. */
  path?: string;
};

const COMPANY_LINKS: FooterLink[] = [
  { label: 'Affiliate', route: 'affiliate' },
  { label: 'Contact', href: 'mailto:digiegold@gmail.com' },
  { label: 'Pricing', route: 'pricing' },
  /* The signed-out demo. Also the page's only inbound static href, which is
   * what keeps scripts/audit-links.mjs from calling it an orphan. */
  { label: 'Live demo', path: '/animate/demo' },
];

const SOCIAL_LINKS: FooterLink[] = [
  { label: 'Discord', route: 'discord' },
  { label: 'YouTube', href: 'https://www.youtube.com/@vaterbytolley' },
  { label: 'Instagram', href: 'https://www.instagram.com/vaterbytolley' },
];

/* Studio-specific legal, not the T-Agent SMS/A2P pages the footer used to
 * point at. A Jelly Studio customer needs the credits/voice-cloning/beta
 * terms they actually clicked through, not a real-estate SaaS policy. */
const BUSINESS_LINKS: FooterLink[] = [
  { label: 'Terms of Use', path: '/animate/terms' },
  { label: 'Privacy', path: '/animate/privacy' },
  { label: 'Beta program', path: '/animate/beta' },
];

/** Violet halo on the brand mark, same recipe as the sidebar. */
const LOGO_GLOW = 'drop-shadow(0 0 12px rgba(143,125,255,0.5))';

const LINK_GROUPS: { heading: string; links: FooterLink[] }[] = [
  { heading: 'Company', links: COMPANY_LINKS },
  { heading: 'Socials', links: SOCIAL_LINKS },
  { heading: 'Business', links: BUSINESS_LINKS },
];

export function Footer(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute } = useRoute();

  const renderLink = (link: FooterLink): React.ReactElement => {
    const baseStyle: React.CSSProperties = {
      fontSize: 13,
      lineHeight: 1.9,
      color: t.textSecondary,
      cursor: 'pointer',
      display: 'block',
      textDecoration: 'none',
      background: 'none',
      border: 'none',
      padding: 0,
      textAlign: 'left',
      fontFamily: 'inherit',
    };

    if (link.route) {
      return (
        <button
          key={link.label}
          type="button"
          className="jc-nav-link"
          onClick={() => setRoute(link.route!)}
          style={baseStyle}
        >
          {link.label}
        </button>
      );
    }

    const isExternal = !!link.href;
    return (
      <a
        key={link.label}
        className="jc-nav-link"
        href={link.href ?? link.path}
        target={isExternal && link.href?.startsWith('http') ? '_blank' : undefined}
        rel={isExternal && link.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        style={baseStyle}
      >
        {link.label}
      </a>
    );
  };

  return (
    <footer
      style={{
        ...glass(t),
        border: 'none',
        borderTop: `1px solid ${t.border}`,
        borderRadius: 0,
        padding: '40px 24px 22px',
        marginTop: 48,
        fontFamily: JELLY_TOKENS.font,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/animate/brand/logo.svg"
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
          style={{ width: 24, height: 24, filter: LOGO_GLOW }}
        />
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.14em',
            color: t.text,
          }}
        >
          JELLY STUDIO
        </span>
      </div>

      <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
        {LINK_GROUPS.map((group) => (
          <div key={group.heading}>
            <MicroLabel
              tone="faint"
              color={t.textFaint}
              size={10.5}
              tracking="0.26em"
              style={{ marginBottom: 10 }}
            >
              {group.heading}
            </MicroLabel>
            {group.links.map(renderLink)}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 30,
          paddingTop: 16,
          borderTop: `1px solid ${t.border}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          fontSize: 11,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: t.textFaint,
        }}
      >
        <span style={{ fontWeight: 600, color: t.textSecondary }}>Jelly Studio</span>
        <span aria-hidden="true">·</span>
        <span>Kansas City, MO</span>
        <span aria-hidden="true">·</span>
        <span className="jc-tabular">v{APP_VERSION}</span>
        <span aria-hidden="true">·</span>
        <span style={{ color: JELLY_TOKENS.cyan }}>Public beta</span>
        <span aria-hidden="true">·</span>
        <span style={{ letterSpacing: '0.06em', textTransform: 'none' }}>
          © 2026 Jelly by Tolley
        </span>
      </div>
    </footer>
  );
}
