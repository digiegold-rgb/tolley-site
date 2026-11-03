import type { Metadata } from 'next';
import { requireOwnerTool } from '@/lib/leads/owner-tool-auth';
import DeliveryDashboard from './DeliveryDashboard';
import './route.css';
export const metadata: Metadata = { title: 'Delivery history | Tolley Route', description: 'Private delivery calendar and territory map.', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function RoutePage() {
  await requireOwnerTool('/route');
  return <DeliveryDashboard />;
}
