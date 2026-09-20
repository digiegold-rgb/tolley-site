import type { Metadata } from 'next';
import AdventureShell from '@/components/game/adventure/AdventureShell';

export const metadata: Metadata = {
  title: 'Portal Hoppers: Whisperwood — 3D adventure | Tolley.io',
  description: 'Explore a woodland world, solve ancient puzzles, and awaken the forest. An original, family-friendly 3D browser adventure.',
  alternates: { canonical: 'https://www.tolley.io/game/adventure' },
};

export default function AdventurePage() {
  return <main><AdventureShell /></main>;
}
