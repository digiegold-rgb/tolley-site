import type { Metadata } from 'next';
import { GameShell } from '@/components/game/GameShell';

export const metadata: Metadata = {
  title: 'Portal Hoppers Classic — 2D co-op adventure | Tolley.io',
  description: 'The original two-player pixel platformer. Ten worlds, fifteen friends, keyboard or touch controls, and your existing classic save.',
  alternates: { canonical: 'https://www.tolley.io/game/classic' },
  openGraph: { title: 'Portal Hoppers Classic', description: 'The original co-op pixel platformer, with keyboard and touch controls.' },
};

export default function ClassicGamePage() {
  return <main><p className="sr-only">Portal Hoppers Classic is a free co-op pixel platformer. Arrow keys move, Space jumps, X bashes, and C uses powers. Player two uses WASD and Shift. Touch controls appear on phones and tablets.</p><GameShell /></main>;
}
