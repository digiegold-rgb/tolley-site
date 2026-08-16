/* Jelly Studio type — loaded ONCE for every /animate route by
 * app/animate/layout.tsx. Space Grotesk carries headings + UI + body,
 * Instrument Serif italic is the cinematic accent (title cards, the hero
 * phrase, "Directed by you."). next/font self-hosts both at build time. */
import { Instrument_Serif, Space_Grotesk } from 'next/font/google';

export const jellyDisplay = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jelly-display',
  display: 'swap',
});

export const jellySerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-jelly-serif',
  display: 'swap',
});
