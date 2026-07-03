"use client";

import { useState } from "react";

type Account = {
  id: string;
  plaidAccountId: string;
  name: string;
  mask: string | null;
  isPersonal: boolean;
};

export function AccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchAccount(id: string, body: Partial<Account>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/vater/budget/plaid/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setAccounts((prev) => prev.map((a) => (a.id === id ? j.account : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncReport(null);
    try {
      const res = await fetch("/api/vater/budget/plaid/sync", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setSyncReport(j.report);
      const refresh = await fetch("/api/vater/budget/plaid/accounts");
      if (refresh.ok) {
        const data = await refresh.json();
        setAccounts(data.accounts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
        >
          {syncing ? "Syncing…" : "Sync from Plaid"}
        </button>
        <span className="text-xs text-slate-500">{accounts.length} linked</span>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {syncReport ? (
        <pre className="vater-card max-h-60 overflow-auto p-4 text-xs text-slate-300">
          {JSON.stringify(syncReport, null, 2)}
        </pre>
      ) : null}

      {accounts.length === 0 ? (
        <div className="vater-card p-6 text-center text-sm text-slate-400">
          No accounts yet. Click "Sync from Plaid" to discover linked accounts.
        </div>
      ) : (
        <div className="vater-card divide-y divide-slate-800">
          {accounts.map((a) => (
            <div key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  value={a.name}
                  onChange={(e) =>
                    setAccounts((prev) =>
                      prev.map((p) => (p.id === a.id ? { ...p, name: e.target.value } : p)),
                    )
                  }
                  onBlur={(e) => {
                    if (e.target.value.trim() !== a.name) {
                      patchAccount(a.id, { name: e.target.value.trim() });
                    }
                  }}
                  className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-100 transition hover:border-slate-700 focus:border-sky-500 focus:outline-none"
                />
                <div className="mt-1 px-2 text-xs text-slate-500">
                  {a.plaidAccountId}{a.mask ? ` · …${a.mask}` : ""}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={a.isPersonal}
                  disabled={savingId === a.id}
                  onChange={(e) => patchAccount(a.id, { isPersonal: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                Personal (include in budget)
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
