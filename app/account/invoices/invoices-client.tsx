'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  amountDue: number;
  status: InvoiceStatus;
  contact: { id: string; name: string; email: string | null } | null;
}

// Special tab value: shows saved delivery-run templates instead of an invoice
// status filter, so recurring runs can be billed without leaving Invoices.
const REGULAR_RUNS = 'REGULAR_RUNS';

const statusTabs: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Void', value: 'VOID' },
  { label: '★ Regular Runs', value: REGULAR_RUNS },
];

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    DRAFT: 'bg-white/[0.08] text-white/60',
    SENT: 'bg-amber-500/20 text-amber-400',
    PAID: 'bg-cyan-500/20 text-cyan-400',
    OVERDUE: 'bg-red-500/20 text-red-400',
    VOID: 'bg-white/[0.06] text-white/30',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function InvoicesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') ?? '';
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function handleDraft(inv: Invoice, e: React.MouseEvent) {
    e.stopPropagation();
    setDraftingId(inv.id);
    setNotice('');
    setError('');
    try {
      const res = await fetch(`/api/account/invoices/${inv.id}/email-draft`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create draft');
      const dest = json.to ? ` (to ${json.to})` : '';
      setNotice(`${inv.invoiceNumber}: draft saved in ${json.mailbox || 'jared@yourkchomes.com'}${dest}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating draft');
    } finally {
      setDraftingId(null);
    }
  }

  const fetchInvoices = useCallback(async () => {
    if (statusFilter === REGULAR_RUNS) return; // handled by RegularRunsPanel
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/account/invoices?${params}`);
      if (!res.ok) throw new Error('Failed to load invoices');
      const json = await res.json();
      setInvoices(json.invoices);
      setTotalPages(json.pagination.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
                const qs = tab.value ? `?status=${tab.value}` : '';
                router.replace(`/account/invoices${qs}`);
              }}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === tab.value
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-white/60 hover:bg-white/[0.06]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Link
          href="/account/invoices/new"
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
        >
          New Invoice
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Notice */}
      {notice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 text-sm">
          {notice}
        </div>
      )}

      {/* Regular Runs tab — bill a recurring run without leaving Invoices */}
      {statusFilter === REGULAR_RUNS && <RegularRunsPanel router={router} />}

      {/* Table */}
      {statusFilter !== REGULAR_RUNS && (
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
                  <th className="px-5 py-3">Invoice #</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3 text-right">Amount Due</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => router.push(`/account/invoices/${inv.id}`)}
                    className="hover:bg-white/[0.04] cursor-pointer"
                  >
                    <td className="px-5 py-3 text-cyan-400 font-mono text-xs">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-5 py-3 text-white">
                      {inv.contact?.name || '—'}
                    </td>
                    <td className="px-5 py-3 text-white/60">
                      {new Date(inv.issueDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-3 text-white/60">
                      {inv.dueDate
                        ? new Date(inv.dueDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-white font-mono">
                      {fmt.format(inv.total)}
                    </td>
                    <td className="px-5 py-3 text-right text-white font-mono">
                      {fmt.format(inv.amountDue)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <a
                        href={`/api/account/invoices/${inv.id}/pdf`}
                        onClick={(e) => e.stopPropagation()}
                        title={`Download ${inv.invoiceNumber} as PDF`}
                        className="inline-block text-xs text-white/70 hover:text-white px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] transition-colors"
                      >
                        ↓ PDF
                      </a>
                      <button
                        onClick={(e) => handleDraft(inv, e)}
                        disabled={draftingId === inv.id}
                        title="Save Gmail draft (PDF attached) in jared@yourkchomes.com"
                        className="ml-1.5 inline-block text-xs text-white/70 hover:text-white px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] transition-colors disabled:opacity-40"
                      >
                        {draftingId === inv.id ? '…' : '✉ Draft'}
                      </button>
                    </td>
                  </tr>
                ))}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-white/30">
                      No invoices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Pagination */}
      {statusFilter !== REGULAR_RUNS && totalPages > 1 && (
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
    </div>
  );
}

// ── Regular Runs tab ────────────────────────────────────────────────────────
interface RunTemplate {
  id: string;
  label: string;
  dropLocation: string;
  billingMode: string;
  miles: number;
  rate: number;
  notes: string | null;
}
interface RunContact {
  id: string;
  name: string;
  regularRuns: RunTemplate[];
}

function RegularRunsPanel({ router }: { router: ReturnType<typeof useRouter> }) {
  const [contacts, setContacts] = useState<RunContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/account/regular-runs');
        if (!res.ok) throw new Error('Failed to load regular runs');
        const json = await res.json();
        setContacts(json.contacts);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // "New" → generate a DRAFT invoice from the run, then jump to it to attach
  // the PDF and send. Pass `bundle` (the rest of the contact's run ids) to put
  // every drop on ONE invoice — e.g. Guadalupe's monthly run.
  async function newDraft(contactId: string, runId: string, bundle: string[] = []) {
    setBusyId(bundle.length ? `all:${contactId}` : runId);
    setError('');
    try {
      const res = await fetch(
        `/api/account/contacts/${contactId}/regular-runs/${runId}/draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bundle.length ? { runIds: bundle } : {}),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create draft');
      router.push(`/account/invoices/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-12 text-center text-white/30 text-sm">
          No regular runs yet. Open a customer under Contacts to add saved runs.
        </div>
      ) : (
        contacts.map((c) => (
          <div
            key={c.id}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5 space-y-4"
          >
            {(() => {
              const picked = c.regularRuns.filter((r) => selected.has(r.id));
              const toBill = picked.length ? picked : c.regularRuns;
              return (
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white/80">{c.name}</h3>
                  <div className="flex items-center gap-3">
                    {c.regularRuns.length > 1 && (
                      <button
                        onClick={() =>
                          newDraft(c.id, toBill[0].id, toBill.slice(1).map((r) => r.id))
                        }
                        disabled={busyId !== null}
                        className="bg-white/[0.08] hover:bg-cyan-500 hover:text-black border border-white/[0.12] text-white/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {busyId === `all:${c.id}`
                          ? 'Creating…'
                          : picked.length
                            ? `Bill ${picked.length} selected → one invoice`
                            : `Bill all ${c.regularRuns.length} → one invoice`}
                      </button>
                    )}
                    <Link
                      href={`/account/contacts/${c.id}`}
                      className="text-xs text-white/40 hover:text-cyan-400 transition-colors"
                    >
                      Manage runs →
                    </Link>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {c.regularRuns.map((run) => (
                <div
                  key={run.id}
                  className={`rounded-lg border p-4 flex flex-col justify-between transition-colors ${
                    selected.has(run.id)
                      ? 'border-cyan-500/50 bg-cyan-500/[0.06]'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selected.has(run.id)}
                      onChange={() => toggleSelect(run.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-white/[0.06] accent-cyan-500"
                      title="Select to bill several stops on one invoice"
                    />
                    <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="text-white font-medium text-sm truncate">{run.label}</div>
                      {run.billingMode === 'FLAT' && (
                        <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          weight
                        </span>
                      )}
                    </div>
                    <div className="text-white/50 text-xs mt-0.5 truncate">{run.dropLocation}</div>
                    <div className="text-white/40 text-xs mt-1 font-mono">
                      {run.billingMode === 'FLAT' ? (
                        <span className="text-cyan-300">
                          {run.rate > 0 ? `≈ ${fmt.format(run.rate)}` : 'set weekly'}
                        </span>
                      ) : (
                        <>
                          {run.miles} mi × {fmt.format(run.rate)} ={' '}
                          <span className="text-cyan-300">{fmt.format(run.miles * run.rate)}</span>
                        </>
                      )}
                    </div>
                    {run.notes && (
                      <div className="text-amber-300/70 text-[11px] mt-1 leading-snug">{run.notes}</div>
                    )}
                    </div>
                  </div>
                  <button
                    onClick={() => newDraft(c.id, run.id)}
                    disabled={busyId !== null}
                    className="mt-3 self-end bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-1.5 text-xs transition-colors disabled:opacity-50"
                  >
                    {busyId === run.id ? 'Creating…' : 'New'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
