'use client';

import { useEffect, useState, useCallback, useRef, DragEvent } from 'react';
import { useSearchParams } from 'next/navigation';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface BankAccount {
  id: string;
  name: string;
  code: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'RECEIVE' | 'SPEND';
  accountCode: string | null;
  isReconciled: boolean;
  needsReview: boolean;
  bankAccount: BankAccount | null;
  bankAccountId: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  class: string;
}

export default function TransactionsClient() {
  const searchParams = useSearchParams();
  const initialNeedsReview = searchParams.get('needsReview') === 'true';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState(initialNeedsReview ? 'true' : '');
  const [searchQuery, setSearchQuery] = useState('');

  // CSV Import Modal
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; needsReview: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/account/accounts');
    if (res.ok) {
      const json = await res.json();
      setAccounts(json.accounts);
      // Extract unique bank accounts from first fetch
      const banks = json.accounts.filter(
        (a: Account) => a.class === 'ASSET' && a.code?.startsWith('1'),
      );
      setBankAccounts(banks.map((b: Account) => ({ id: b.id, name: b.name, code: b.code })));
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (bankFilter) params.set('bankAccount', bankFilter);
      if (reviewFilter) params.set('needsReview', reviewFilter);
      if (searchQuery) params.set('q', searchQuery);

      const res = await fetch(`/api/account/transactions?${params}`);
      if (!res.ok) throw new Error('Failed to load transactions');
      const json = await res.json();
      setTransactions(json.transactions);
      setTotalPages(json.pagination.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, bankFilter, reviewFilter, searchQuery]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  async function handleAccountChange(txId: string, accountCode: string) {
    try {
      const res = await fetch(`/api/account/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountCode, needsReview: false }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setTransactions((prev) => prev.map((t) => (t.id === txId ? updated : t)));
    } catch {
      // silent fail, user can retry
    }
  }

  async function handleReconciledChange(txId: string, isReconciled: boolean) {
    try {
      const res = await fetch(`/api/account/transactions/${txId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isReconciled }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      setTransactions((prev) => prev.map((t) => (t.id === txId ? updated : t)));
    } catch {
      // silent fail
    }
  }

  // CSV Import handlers
  function handleDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setImportFile(e.dataTransfer.files[0]);
    }
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await fetch('/api/account/transactions/import', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Import failed');
      }
      const result = await res.json();
      setImportResult(result);
      // Refresh transactions
      fetchTransactions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  // Group accounts by class for the dropdown
  const accountsByClass: Record<string, Account[]> = {};
  for (const acct of accounts) {
    if (!accountsByClass[acct.class]) accountsByClass[acct.class] = [];
    accountsByClass[acct.class].push(acct);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-white/40 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Bank Account</label>
          <select
            value={bankFilter}
            onChange={(e) => {
              setBankFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Review</label>
          <select
            value={reviewFilter}
            onChange={(e) => {
              setReviewFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="true">Needs Review</option>
            <option value="false">Reviewed</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-white/40 mb-1">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search descriptions..."
            className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-1.5 text-sm"
          />
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-1.5 text-sm transition-colors"
        >
          Import CSV
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 underline text-xs">
            dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.08]">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Bank</th>
                  <th className="px-4 py-3 text-center">Rec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-white/[0.04] ${
                      tx.needsReview ? 'bg-amber-500/[0.04] border-l-2 border-l-amber-500/40' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-white/60 whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-white max-w-[300px]">
                      <span className="truncate block">{tx.description}</span>
                      {tx.needsReview && (
                        <span className="text-[10px] text-amber-400 uppercase tracking-wider">
                          Needs Review
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono whitespace-nowrap ${
                        tx.type === 'RECEIVE' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {tx.type === 'RECEIVE' ? '+' : '-'}
                      {fmt.format(tx.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={tx.accountCode || ''}
                        onChange={(e) => handleAccountChange(tx.id, e.target.value)}
                        className="bg-white/[0.06] border border-white/[0.12] rounded text-white text-xs px-2 py-1 max-w-[180px]"
                      >
                        <option value="">Uncategorized</option>
                        {Object.entries(accountsByClass).map(([cls, accts]) => (
                          <optgroup key={cls} label={cls}>
                            {accts.map((a) => (
                              <option key={a.code} value={a.code}>
                                {a.code} — {a.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-white/40 text-xs whitespace-nowrap">
                      {tx.bankAccount?.name || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={tx.isReconciled}
                        onChange={(e) => handleReconciledChange(tx.id, e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-white/[0.06] text-cyan-500 accent-cyan-500"
                      />
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-white/30">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/[0.08] text-white disabled:opacity-30 hover:bg-white/[0.12] transition-colors"
          >
            Prev
          </button>
          <span className="text-sm text-white/40">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg bg-white/[0.08] text-white disabled:opacity-30 hover:bg-white/[0.12] transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f0e17] border border-white/[0.12] rounded-xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Import CSV</h3>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="text-white/40 hover:text-white text-xl"
              >
                ×
              </button>
            </div>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-white/[0.12] hover:border-white/[0.24]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) setImportFile(e.target.files[0]);
                }}
              />
              {importFile ? (
                <div>
                  <p className="text-white font-medium">{importFile.name}</p>
                  <p className="text-white/40 text-xs mt-1">
                    {(importFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-white/60">Drop CSV file here or click to browse</p>
                  <p className="text-white/30 text-xs mt-1">Bluevine bank export format</p>
                </div>
              )}
            </div>

            {/* Import Result */}
            {importResult && (
              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 text-sm">
                <p className="text-cyan-400 font-medium">Import Complete</p>
                <div className="mt-2 space-y-1 text-white/60">
                  <p>Inserted: {importResult.inserted}</p>
                  <p>Skipped (duplicates): {importResult.skipped}</p>
                  <p>Needs Review: {importResult.needsReview}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-4 py-2 text-sm transition-colors"
              >
                {importResult ? 'Done' : 'Cancel'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
