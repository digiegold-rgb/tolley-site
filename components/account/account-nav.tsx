'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: 'Dashboard', href: '/account', icon: '📊' },
  { label: 'Invoices', href: '/account/invoices', icon: '📄' },
  { label: 'Transactions', href: '/account/transactions', icon: '💳' },
  { label: 'Income', href: '/account/income', icon: '💰' },
  { label: 'Tax', href: '/account/tax', icon: '🏛️' },
  { label: 'Reports', href: '/account/reports', icon: '📈' },
  { label: 'Contacts', href: '/account/contacts', icon: '👤' },
  { label: 'Chart of Accounts', href: '/account/accounts', icon: '📋' },
];

export default function AccountNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/account') return pathname === '/account';
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-white/[0.08] pb-px">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
            isActive(tab.href)
              ? 'bg-white/[0.08] text-cyan-400 border-b-2 border-cyan-400'
              : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <span className="text-base">{tab.icon}</span>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
