import { requireAdminPageSession } from '@/lib/admin-auth';
import DashboardClient from './dashboard-client';

export default async function AccountDashboardPage() {
  await requireAdminPageSession('/account');
  return <DashboardClient />;
}
