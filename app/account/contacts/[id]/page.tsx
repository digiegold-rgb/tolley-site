import { requireAdminPageSession } from '@/lib/admin-auth';
import ContactDetailClient from './contact-detail-client';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPageSession('/account/contacts');
  const { id } = await params;
  return <ContactDetailClient contactId={id} />;
}
