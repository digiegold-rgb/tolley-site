import { requireAdminPageSession } from '@/lib/admin-auth';
import ContactsClient from './contacts-client';

export default async function ContactsPage() {
  await requireAdminPageSession('/account/contacts');
  return <ContactsClient />;
}
