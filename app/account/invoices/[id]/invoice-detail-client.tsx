'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOID';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  account?: { code: string; name: string } | null;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string | null;
  reference: string | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  reference: string | null;
  notes: string | null;
  subTotal: number;
  total: number;
  amountDue: number;
  amountPaid: number;
  stripePaymentLinkUrl: string | null;
  sentAt: string | null;
  paidAt: string | null;
  contact: Contact | null;
  lineItems: LineItem[];
  payments: Payment[];
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, string> = {
    DRAFT: 'bg-white/[0.08] text-white/60',
    SENT: 'bg-amber-500/20 text-amber-400',
    PAID: 'bg-cyan-500/20 text-cyan-400',
    OVERDUE: 'bg-red-500/20 text-red-400',
    VOID: 'bg-white/[0.06] text-white/30',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function InvoiceDetailClient({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`);
      if (!res.ok) throw new Error('Invoice not found');
      const json = await res.json();
      setInvoice(json);
      setEditNotes(json.notes || '');
      setEditDueDate(json.dueDate ? json.dueDate.split('T')[0] : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  async function handleSend() {
    setActionLoading('send');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}/send`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to send');
      }
      await fetchInvoice();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading('');
    }
  }

  async function handleMarkPaid() {
    setActionLoading('paid');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      });
      if (!res.ok) throw new Error('Failed to mark as paid');
      await fetchInvoice();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading('');
    }
  }

  async function handleVoid() {
    if (!confirm('Void this invoice? This cannot be undone.')) return;
    setActionLoading('void');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to void');
      await fetchInvoice();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading('');
    }
  }

  async function handleSaveEdit() {
    setActionLoading('edit');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: editNotes,
          dueDate: editDueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setEditing(false);
      await fetchInvoice();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading('');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-red-400">
        {error}
        <button onClick={() => router.back()} className="block mt-3 text-sm text-white/40 hover:text-white/60">
          Go Back
        </button>
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white font-mono">{invoice.invoiceNumber}</h2>
            <StatusBadge status={invoice.status} />
          </div>
          {invoice.contact && (
            <p className="text-white/60 mt-1">{invoice.contact.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === 'DRAFT' && (
            <>
              <button
                onClick={() => setEditing(!editing)}
                className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-3 py-1.5 text-sm transition-colors"
              >
                {editing ? 'Cancel Edit' : 'Edit'}
              </button>
              <button
                onClick={handleSend}
                disabled={!!actionLoading}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
              >
                {actionLoading === 'send' ? 'Sending...' : 'Send'}
              </button>
            </>
          )}
          {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
            <button
              onClick={handleMarkPaid}
              disabled={!!actionLoading}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            >
              {actionLoading === 'paid' ? 'Updating...' : 'Mark Paid'}
            </button>
          )}
          {invoice.status !== 'VOID' && invoice.status !== 'PAID' && (
            <button
              onClick={handleVoid}
              disabled={!!actionLoading}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            >
              Void
            </button>
          )}
          <Link
            href={`/account/invoices/${invoiceId}/print`}
            target="_blank"
            className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-3 py-1.5 text-sm transition-colors"
          >
            Print
          </Link>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div>
            <p className="text-xs text-white/40">Issue Date</p>
            <p className="text-sm text-white">
              {new Date(invoice.issueDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">Due Date</p>
            {editing ? (
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="mt-1 w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-2 py-1 text-sm"
              />
            ) : (
              <p className="text-sm text-white">
                {invoice.dueDate
                  ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-white/40">Reference</p>
            <p className="text-sm text-white">{invoice.reference || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Sent At</p>
            <p className="text-sm text-white">
              {invoice.sentAt
                ? new Date(invoice.sentAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—'}
            </p>
          </div>
        </div>

        {/* Contact Info */}
        {invoice.contact && (
          <div className="border-t border-white/[0.08] pt-4 mb-6">
            <p className="text-xs text-white/40 mb-1">Bill To</p>
            <p className="text-sm text-white font-medium">{invoice.contact.name}</p>
            {invoice.contact.email && (
              <p className="text-xs text-white/60">{invoice.contact.email}</p>
            )}
            {invoice.contact.phone && (
              <p className="text-xs text-white/60">{invoice.contact.phone}</p>
            )}
            {invoice.contact.address && (
              <p className="text-xs text-white/60">
                {invoice.contact.address}
                {invoice.contact.city && `, ${invoice.contact.city}`}
                {invoice.contact.state && `, ${invoice.contact.state}`}
                {invoice.contact.zip && ` ${invoice.contact.zip}`}
              </p>
            )}
          </div>
        )}

        {/* Line Items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.08]">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit Price</th>
                <th className="pb-2">Account</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {invoice.lineItems.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 text-white">{item.description}</td>
                  <td className="py-2.5 text-center text-white/60">{item.quantity}</td>
                  <td className="py-2.5 text-right text-white/60 font-mono">
                    {fmt.format(item.unitAmount)}
                  </td>
                  <td className="py-2.5 text-white/40 text-xs">
                    {item.account ? `${item.account.code} — ${item.account.name}` : '—'}
                  </td>
                  <td className="py-2.5 text-right text-white font-mono">
                    {fmt.format(item.lineAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span className="text-white font-mono">{fmt.format(invoice.subTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Paid</span>
              <span className="text-emerald-400 font-mono">
                {fmt.format(invoice.amountPaid)}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-white/[0.08] pt-2">
              <span className="text-white">Amount Due</span>
              <span className="text-cyan-400 font-mono">{fmt.format(invoice.amountDue)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {editing ? (
          <div className="mt-4">
            <label className="block text-xs text-white/40 mb-1">Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-2 text-sm resize-none"
            />
            <button
              onClick={handleSaveEdit}
              disabled={!!actionLoading}
              className="mt-2 bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              {actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        ) : (
          invoice.notes && (
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              <p className="text-xs text-white/40 mb-1">Notes</p>
              <p className="text-sm text-white/60 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )
        )}
      </div>

      {/* Stripe Payment Link */}
      {invoice.stripePaymentLinkUrl && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5">
          <p className="text-xs text-white/40 mb-2">Stripe Payment Link</p>
          <a
            href={invoice.stripePaymentLinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-cyan-400 hover:text-cyan-300 break-all"
          >
            {invoice.stripePaymentLinkUrl}
          </a>
        </div>
      )}

      {/* Payment History */}
      {invoice.payments.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm overflow-hidden">
          <div className="p-5 border-b border-white/[0.08]">
            <h3 className="text-sm font-semibold text-white/60">Payment History</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.08]">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {invoice.payments.map((pmt) => (
                <tr key={pmt.id} className="hover:bg-white/[0.04]">
                  <td className="px-5 py-3 text-white/60">
                    {new Date(pmt.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-3 text-white/60">{pmt.method || '—'}</td>
                  <td className="px-5 py-3 text-white/40 text-xs font-mono">
                    {pmt.reference || '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-emerald-400 font-mono">
                    {fmt.format(pmt.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
