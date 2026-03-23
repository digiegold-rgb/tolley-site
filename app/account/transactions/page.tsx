import { requireAdminPageSession } from '@/lib/admin-auth';
import TransactionsClient from './transactions-client';

export default async function TransactionsPage() {
  await requireAdminPageSession('/account/transactions');
  return <TransactionsClient />;
}
