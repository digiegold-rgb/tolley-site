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
    <div className="relative min-h-screen bg-[#06050a]">
      <div aria-hidden="true" className="site-dot-grid-purple pointer-events-none fixed inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-2xl font-bold text-white mb-6">Account</h1>
        <AccountNav />
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
