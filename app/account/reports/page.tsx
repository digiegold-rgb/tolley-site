import { requireAdminPageSession } from '@/lib/admin-auth';
import ReportsClient from './reports-client';

export default async function ReportsPage() {
  await requireAdminPageSession('/account/reports');
  return <ReportsClient />;
}
