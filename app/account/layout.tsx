import { requireAdminPageSession } from '@/lib/admin-auth';
import AccountNav from '@/components/account/account-nav';

export const metadata = {
  title: 'Account | Tolley.io',
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPageSession('/account');

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Account</h1>
        <AccountNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
