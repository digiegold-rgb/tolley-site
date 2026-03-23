import { requireAdminPageSession } from '@/lib/admin-auth';
import IncomeClient from './income-client';

export default async function IncomePage() {
  await requireAdminPageSession('/account/income');
  return <IncomeClient />;
}
