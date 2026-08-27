import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';

import { jellyDisplay, jellySerif } from '@/components/animate/fonts';
import { LISTING_BRAND } from '@/components/animate/brands';
import { ProductProvider } from '@/components/animate/product-context';
import '@/app/animate/animate.css';

/* Listing Studio by Jelly! — tolley.io/realestateanimated.
 *
 * A clone of app/animate/layout.tsx wearing the LISTING_BRAND palette. Same
 * font variables (--font-jelly-display / --font-jelly-serif) so every shared
 * component keeps its type; same animate.css keyframes + legacy skin.
 *
 * Colour mechanism: the wrapper sets the brand's `--jb-*` custom properties
 * inline. components/animate/tokens.ts reads `var(--jb-*, <jelly hex>)`, so
 * everything under this layout re-colours navy/gold while /animate — where
 * nothing sets the variables — is untouched. Light-theme overrides
 * (LISTING_BRAND.cssVarsLight) are layered on by the Shell when the customer
 * flips the theme — theme-context.tsx is React state, not a DOM attribute, so
 * the Shell root carries `data-theme="dark|light"` plus the light variables
 * inline, and mirrors both onto <html> for portaled modals
 * (Shell.tsx useBrandVarsOnRoot). Signed-out surfaces are always dark.
 *
 * `display: contents` generates no box, so no layout changes; the variables
 * inherit through it. */

const OG_IMAGE = `https://www.tolley.io${LISTING_BRAND.og.image}`;

export const metadata: Metadata = {
  title: `${LISTING_BRAND.name} | Tolley.io`,
  description: LISTING_BRAND.og.description,
  openGraph: {
    type: 'website',
    siteName: LISTING_BRAND.name,
    title: LISTING_BRAND.og.title,
    description: LISTING_BRAND.og.description,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: LISTING_BRAND.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: LISTING_BRAND.og.title,
    description: LISTING_BRAND.og.description,
    images: [OG_IMAGE],
  },
  icons: {
    icon: '/realestateanimated/brand/favicon-512.png',
    apple: '/realestateanimated/brand/favicon-512.png',
  },
};

export const viewport: Viewport = {
  themeColor: LISTING_BRAND.themeColor,
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ListingStudioLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${jellyDisplay.variable} ${jellySerif.variable}`}
      data-product={LISTING_BRAND.product}
      style={{ display: 'contents', ...(LISTING_BRAND.cssVars as CSSProperties) }}
    >
      <ProductProvider brand={LISTING_BRAND}>{children}</ProductProvider>
    </div>
  );
}
