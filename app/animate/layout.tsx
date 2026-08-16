import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { jellyDisplay, jellySerif } from '@/components/animate/fonts';
import './animate.css';

/* Jelly Studio — isolated layout.
 *
 * Path-isolated from the legacy site layout (the root layout already supplies
 * <html>/<body>). Its ONE job is to hand every /animate surface — landing,
 * studio shell, demo, terms/privacy/beta — the cinema type (Space Grotesk +
 * Instrument Serif) and the shared keyframes/legacy skin in animate.css.
 * `display: contents` generates no box, so no layout changes; the font
 * variables inherit through it. */

export const metadata: Metadata = {
  title: 'Jelly Studio (Beta) | Tolley.io',
  description: 'Real cinematic films about people’s lives — pay per render, no subscription.',
  openGraph: {
    type: 'website',
    siteName: 'Jelly Studio',
    title: 'Jelly Studio — your life is already a motion picture',
    description: 'Real cinematic films about people’s lives — pay per film ($1–7 all in), never per month. Public beta.',
    images: [{ url: 'https://www.tolley.io/animate/brand/og-cinema-1200x630.png', width: 1200, height: 630, alt: 'Jelly Studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jelly Studio — your life is already a motion picture',
    description: 'Real cinematic films about people’s lives — pay per film ($1–7 all in), never per month. Public beta.',
    images: ['https://www.tolley.io/animate/brand/og-cinema-1200x630.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A14',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AnimateStudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${jellyDisplay.variable} ${jellySerif.variable}`} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
