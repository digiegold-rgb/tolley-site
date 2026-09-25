/* Jelly Studio type — loaded ONCE for every /animate route by
 * app/animate/layout.tsx. Space Grotesk carries headings + UI + body,
 * Instrument Serif italic is the cinematic accent (title cards, the hero
 * phrase, "Directed by you."). Space Grotesk is bundled locally to avoid build-time Google URL parsing. */
import { Instrument_Serif } from 'next/font/google';
import localFont from 'next/font/local';

export const jellyDisplay = localFont({
  src: '../../public/fonts/space-grotesk/SpaceGrotesk-variable.ttf',
  weight: '400 700',
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
