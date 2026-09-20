import type { Metadata } from 'next';
import PortalShell from '@/components/game/portal3d/PortalShell';

export const metadata: Metadata = {
  title: 'Portal Hoppers 3D — 3D adventure | Tolley.io',
  description: 'The original Portal Hoppers rescue adventure in 3D. Ten magical worlds, fifteen friends, Cubo, earned powers, and the original soundtrack.',
  alternates: { canonical: 'https://www.tolley.io/game/adventure' },
};

export default function AdventurePage() {
  return <main><PortalShell /></main>;
}
