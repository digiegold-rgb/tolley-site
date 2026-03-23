import { requireAdminPageSession } from '@/lib/admin-auth';
import InvoicesClient from './invoices-client';

export default async function InvoicesPage() {
  await requireAdminPageSession('/account/invoices');
  return <InvoicesClient />;
}
