'use client';

import { useEffect, useState, useCallback } from 'react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  class: string;
  status: string;
}

const classOrder = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const classColors: Record<string, string> = {
  ASSET: 'text-cyan-400',
  LIABILITY: 'text-red-400',
  EQUITY: 'text-purple-400',
  REVENUE: 'text-emerald-400',
  EXPENSE: 'text-amber-400',
};

const classBgColors: Record<string, string> = {
  ASSET: 'bg-cyan-500/10 border-cyan-500/20',
  LIABILITY: 'bg-red-500/10 border-red-500/20',
  EQUITY: 'bg-purple-500/10 border-purple-500/20',
  REVENUE: 'bg-emerald-500/10 border-emerald-500/20',
  EXPENSE: 'bg-amber-500/10 border-amber-500/20',
};

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/account/accounts');
      if (!res.ok) throw new Error('Failed to load accounts');
      const json = await res.json();
      setAccounts(json.accounts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Group by class
  const grouped: Record<string, Account[]> = {};
  for (const acct of accounts) {
    const cls = acct.class || 'OTHER';
    if (!grouped[cls]) grouped[cls] = [];
    grouped[cls].push(acct);
  }

  // Sort groups by classOrder
  const sortedClasses = Object.keys(grouped).sort((a, b) => {
    const ai = classOrder.indexOf(a);
    const bi = classOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">{accounts.length} accounts</p>
      </div>

      {sortedClasses.map((cls) => (
        <div key={cls}>
          {/* Class Header */}
          <div
            className={`inline-flex items-center px-3 py-1 rounded-t-lg border text-xs font-semibold uppercase tracking-wider ${
              classBgColors[cls] || 'bg-white/[0.06] border-white/[0.12]'
            } ${classColors[cls] || 'text-white/60'}`}
          >
            {cls}
            <span className="ml-2 text-[10px] opacity-60">{grouped[cls].length}</span>
          </div>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl rounded-tl-none backdrop-blur-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.08]">
                  <th className="px-5 py-2.5 w-24">Code</th>
                  <th className="px-5 py-2.5">Name</th>
                  <th className="px-5 py-2.5 w-36">Type</th>
                  <th className="px-5 py-2.5 w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {grouped[cls].map((acct) => (
                  <tr key={acct.id} className="hover:bg-white/[0.04]">
                    <td className="px-5 py-2 text-cyan-400 font-mono text-xs">{acct.code}</td>
                    <td className="px-5 py-2 text-white">{acct.name}</td>
                    <td className="px-5 py-2 text-white/40 text-xs">{acct.type}</td>
                    <td className="px-5 py-2">
                      {acct.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-400">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-white/[0.06] text-white/30">
                          {acct.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
