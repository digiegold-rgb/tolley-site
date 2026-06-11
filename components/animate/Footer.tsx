'use client';

/* Footer — ported from vater-core.jsx lines 395-421. Copyright updated to 2026. */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';

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
];

const SOCIAL_LINKS: FooterLink[] = [
  { label: 'Discord', route: 'discord' },
  { label: 'YouTube', href: 'https://www.youtube.com/@vaterbytolley' },
  { label: 'Instagram', href: 'https://www.instagram.com/vaterbytolley' },
];

const BUSINESS_LINKS: FooterLink[] = [
  { label: 'Terms of Use', path: '/terms' },
  { label: 'Privacy', path: '/privacy' },
];

export function Footer(): React.ReactElement {
  const { t } = useTheme();
  const { setRoute } = useRoute();

  const renderLink = (link: FooterLink): React.ReactElement => {
    const baseStyle: React.CSSProperties = {
      fontSize: 13,
      color: JELLY_TOKENS.brand,
      cursor: 'pointer',
      marginBottom: 4,
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
        padding: '48px 24px 24px',
        marginTop: 48,
        borderTop: `1px solid ${t.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: JELLY_TOKENS.gradCreate,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            color: '#fff',
            fontWeight: 700,
          }}
        >
          J
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Jelly by Tolley</span>
      </div>
      <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: t.text,
              marginBottom: 8,
            }}
          >
            Company
          </div>
          {COMPANY_LINKS.map(renderLink)}
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: t.text,
              marginBottom: 8,
            }}
          >
            Socials
          </div>
          {SOCIAL_LINKS.map(renderLink)}
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: t.text,
              marginBottom: 8,
            }}
          >
            Business
          </div>
          {BUSINESS_LINKS.map(renderLink)}
        </div>
      </div>
      <div style={{ marginTop: 24, fontSize: 12, color: t.textSecondary }}>
        Copyright © 2026 Jelly by Tolley
      </div>
    </footer>
  );
}
