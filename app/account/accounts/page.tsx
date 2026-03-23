import { requireAdminPageSession } from '@/lib/admin-auth';
import AccountsClient from './accounts-client';

export default async function AccountsPage() {
  await requireAdminPageSession('/account/accounts');
  return <AccountsClient />;
}
