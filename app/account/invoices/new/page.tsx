import { requireAdminPageSession } from '@/lib/admin-auth';
import NewInvoiceClient from './new-invoice-client';

export default async function NewInvoicePage() {
  await requireAdminPageSession('/account/invoices/new');
  return <NewInvoiceClient />;
}
