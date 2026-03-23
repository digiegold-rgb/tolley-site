import { requireAdminPageSession } from '@/lib/admin-auth';
import InvoiceDetailClient from './invoice-detail-client';

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPageSession('/account/invoices');
  const { id } = await params;
  return <InvoiceDetailClient invoiceId={id} />;
}
