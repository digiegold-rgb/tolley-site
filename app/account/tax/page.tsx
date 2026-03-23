import { requireAdminPageSession } from '@/lib/admin-auth';
import TaxClient from './tax-client';

export default async function TaxPage() {
  await requireAdminPageSession('/account/tax');
  return <TaxClient />;
}
