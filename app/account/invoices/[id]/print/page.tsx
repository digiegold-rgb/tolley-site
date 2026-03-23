import InvoicePrintClient from './invoice-print-client';

export const metadata = {
  robots: 'noindex',
};

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoicePrintClient invoiceId={id} />;
}
