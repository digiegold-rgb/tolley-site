import type { Metadata } from 'next';
import type { ReactNode } from 'react';

/* Jelly Studio (Beta) — isolated layout.
 *
 * Path-isolated; uses inline styles + system fonts to stay independent
 * of the legacy site layout. The root layout already supplies <html>/<body>.
 */

export const metadata: Metadata = {
  title: 'Jelly Studio (Beta) | Tolley.io',
  description: 'AI-powered YouTube video production console',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AnimateStudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
