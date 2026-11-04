import type { Metadata } from 'next';
import { validateOwnerTool } from '@/lib/leads/owner-tool-auth';
import DeliveryDashboard from './DeliveryDashboard';
import './route.css';
const title = 'Tolley Route | Every day. Every delivery.';
const description = 'Explore delivery history by date, destination and pounds. See busy days on the calendar and frequent delivery areas on the map.';
export const metadata: Metadata = {
  title, description, alternates: { canonical: 'https://www.tolley.io/route' },
  robots: { index: false, follow: false },
  openGraph: { title, description, url: 'https://www.tolley.io/route', siteName: 'Tolley Route', type: 'website', images: [{ url: 'https://www.tolley.io/route/share', width: 1200, height: 630, type: 'image/png', alt: 'Tolley Route — delivery calendar and territory map' }] },
  twitter: { card: 'summary_large_image', title, description, images: ['https://www.tolley.io/route/share'] },
};
export const dynamic = 'force-dynamic';
export default async function RoutePage() {
  return <DeliveryDashboard canEdit={await validateOwnerTool()} />;
}
