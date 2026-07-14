'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';

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
  accountId?: string | null;
  account?: { code: string; name: string } | null;
}

interface EditLine {
  id?: string;
  description: string;
  quantity: number;
  unitAmount: number;
  accountId?: string | null;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  method: string | null;
  reference: string | null;
}

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  blobUrl: string;
  uploadedAt: string;
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
  attachments?: Attachment[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fileKindIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📄';
  return '📎';
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
  const [successMessage, setSuccessMessage] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [editing, setEditing] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [renamingNumber, setRenamingNumber] = useState(false);
  const [numberDraft, setNumberDraft] = useState('');
  const [editLines, setEditLines] = useState<EditLine[]>([]);
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  // Send panel: lets the user review/edit the recipient and add CC before send.
  const [sendPanel, setSendPanel] = useState<null | 'send' | 'resend'>(null);
  const [sendTo, setSendTo] = useState('');
  const [sendCc, setSendCc] = useState('');

  function startEdit() {
    if (!invoice) return;
    setEditLines(
      invoice.lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        accountId: li.accountId ?? null,
      })),
    );
    setEditNotes(invoice.notes || '');
    setEditDueDate(invoice.dueDate ? invoice.dueDate.split('T')[0] : '');
    setEditing(true);
  }

  function updateLine(i: number, field: 'description' | 'quantity' | 'unitAmount', value: string) {
    setEditLines((prev) =>
      prev.map((l, idx) =>
        idx === i
          ? { ...l, [field]: field === 'description' ? value : value === '' ? 0 : Number(value) }
          : l,
      ),
    );
  }
  function removeLine(i: number) {
    setEditLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addLine() {
    setEditLines((prev) => [...prev, { description: '', quantity: 0, unitAmount: 2.8, accountId: null }]);
  }
  function moveLine(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    setEditLines((prev) => {
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  }

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

  // Open the send panel, pre-filling the recipient with the contact's email.
  function openSendPanel(mode: 'send' | 'resend') {
    setError('');
    setSuccessMessage('');
    setSendTo(invoice?.contact?.email || '');
    setSendCc('');
    setSendPanel(mode);
  }

  async function handleSend(mode: 'send' | 'resend' = 'send') {
    const to = sendTo.trim();
    const cc = sendCc.trim();
    if (!to) {
      setError('Enter a recipient email address to send to.');
      return;
    }
    setActionLoading(mode);
    setSuccessMessage('');
    setError('');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      if (json.emailSent) {
        const ccNote =
          Array.isArray(json.cc) && json.cc.length ? ` (cc: ${json.cc.join(', ')})` : '';
        setSuccessMessage(
          `Invoice emailed to ${json.contactEmail}${ccNote}${mode === 'resend' ? ' (resent)' : ''}.`,
        );
        setSendPanel(null);
      } else if (json.emailError) {
        setError(`Payment link ready, but email failed: ${json.emailError}`);
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

  async function handleUnmarkPaid(force = false) {
    if (!force && !confirm(`Unmark ${invoice?.invoiceNumber} as paid and revert it to "Sent"?`)) {
      return;
    }
    setActionLoading('unpaid');
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(
        `/api/account/invoices/${invoiceId}/unmark-paid${force ? '?force=1' : ''}`,
        { method: 'POST' },
      );
      const json = await res.json().catch(() => ({}));

      // Server refused because a real payment is on record — surface the detail
      // and require a second, explicit confirmation before forcing.
      if (res.status === 409 && json.error === 'PAYMENT_ON_RECORD') {
        const proceed = confirm(
          `⚠️ ${json.message}\n\nForce unmark anyway?`,
        );
        if (proceed) await handleUnmarkPaid(true);
        return;
      }

      if (!res.ok) throw new Error(json.error || 'Failed to unmark paid');
      setSuccessMessage('Reverted to "Sent". You can edit or resend it now.');
      await fetchInvoice();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading('');
    }
  }

  async function handleVoid() {
    if (!confirm('Void & delete this invoice? Removes the invoice and any attached files. Cannot be undone.')) return;
    setActionLoading('void');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to void');
      }
      router.push('/account/invoices');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading('');
    }
  }

  async function handleSaveNumber() {
    const next = numberDraft.trim();
    if (!next || !invoice) return;
    if (next === invoice.invoiceNumber) {
      setRenamingNumber(false);
      return;
    }
    setActionLoading('rename');
    setError('');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to rename');
      setRenamingNumber(false);
      setSuccessMessage(`Renamed to ${next}.`);
      await fetchInvoice();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setActionLoading('');
    }
  }

  async function handleEmailDraft() {
    setActionLoading('draft');
    setSuccessMessage('');
    setError('');
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}/email-draft`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create draft');
      const dest = json.to ? ` (to ${json.to})` : '';
      setSuccessMessage(
        `Draft with PDF saved in ${json.mailbox || 'jared@yourkchomes.com'}${dest}. Open Gmail → Drafts to review & send.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating draft');
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
          lineItems: editLines.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity) || 0,
            unitAmount: Number(l.unitAmount) || 0,
            accountId: l.accountId ?? undefined,
          })),
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
      {sendPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => actionLoading === '' && setSendPanel(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-white font-semibold text-lg">
                {sendPanel === 'resend' ? 'Resend' : 'Send'} {invoice.invoiceNumber}
              </h3>
              <p className="text-white/50 text-sm mt-1">
                Review the recipient and add anyone to CC before it goes out.
              </p>
            </div>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/40">To</span>
              <input
                type="email"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="recipient@example.com"
                className="mt-1 w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-white/40">
                CC <span className="text-white/25 normal-case">(comma-separated, optional)</span>
              </span>
              <input
                type="text"
                value={sendCc}
                onChange={(e) => setSendCc(e.target.value)}
                placeholder="alicia@example.com, me@example.com"
                className="mt-1 w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
            </label>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setSendPanel(null)}
                disabled={!!actionLoading}
                className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSend(sendPanel)}
                disabled={!!actionLoading}
                className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-1.5 text-sm font-semibold text-black transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Sending…' : sendPanel === 'resend' ? 'Resend now' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 text-sm">
          {successMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            {renamingNumber ? (
              <>
                <input
                  type="text"
                  value={numberDraft}
                  onChange={(e) => setNumberDraft(e.target.value)}
                  autoFocus
                  className="bg-white/[0.06] border border-cyan-500/40 rounded-lg text-white font-mono text-xl font-bold px-2 py-1 w-48"
                />
                <button
                  onClick={handleSaveNumber}
                  disabled={actionLoading === 'rename'}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-2.5 py-1 text-xs disabled:opacity-50"
                >
                  {actionLoading === 'rename' ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setRenamingNumber(false)}
                  className="text-white/40 hover:text-white/60 text-xs"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-white font-mono">{invoice.invoiceNumber}</h2>
                <button
                  onClick={() => {
                    setNumberDraft(invoice.invoiceNumber);
                    setRenamingNumber(true);
                  }}
                  title="Rename invoice number"
                  className="text-white/30 hover:text-white/70 text-xs"
                >
                  rename
                </button>
              </>
            )}
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
                onClick={() => (editing ? setEditing(false) : startEdit())}
                className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-3 py-1.5 text-sm transition-colors"
              >
                {editing ? 'Cancel Edit' : 'Edit'}
              </button>
              <button
                onClick={() => openSendPanel('send')}
                disabled={!!actionLoading}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
              >
                {actionLoading === 'send' ? 'Sending...' : 'Send'}
              </button>
            </>
          )}
          {(invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
            <>
              <button
                onClick={() => openSendPanel('resend')}
                disabled={!!actionLoading}
                title={
                  invoice.contact?.email
                    ? `Resend to ${invoice.contact.email}`
                    : 'Set a recipient and resend'
                }
                className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
              >
                {actionLoading === 'resend' ? 'Resending...' : 'Resend'}
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={!!actionLoading}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
              >
                {actionLoading === 'paid' ? 'Updating...' : 'Mark Paid'}
              </button>
            </>
          )}
          {invoice.status === 'PAID' && (
            <button
              onClick={() => handleUnmarkPaid()}
              disabled={!!actionLoading}
              title="Revert to Sent — guarded if a real payment is on record"
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            >
              {actionLoading === 'unpaid' ? 'Reverting…' : 'Unmark Paid'}
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
          <a
            href={`/api/account/invoices/${invoiceId}/pdf`}
            className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-3 py-1.5 text-sm transition-colors"
            title="Download invoice as PDF"
          >
            ↓ Download
          </a>
          <button
            onClick={handleEmailDraft}
            disabled={!!actionLoading}
            title="Save a Gmail draft (PDF attached) in jared@yourkchomes.com"
            className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
          >
            {actionLoading === 'draft' ? 'Drafting…' : '✉ Email Draft'}
          </button>
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
        {editing ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Line Items — drag the ⠿ handle to reorder
              </p>
              <button
                onClick={addLine}
                className="text-cyan-400 hover:text-cyan-300 text-xs font-medium"
              >
                + Add line
              </button>
            </div>
            <div className="space-y-1.5">
              {editLines.map((l, i) => (
                <div
                  key={l.id ?? `new-${i}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOver !== i) setDragOver(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) moveLine(dragIndex.current, i);
                    dragIndex.current = null;
                    setDragOver(null);
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                    dragOver === i
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  <span
                    draggable
                    onDragStart={() => {
                      dragIndex.current = i;
                    }}
                    onDragEnd={() => {
                      dragIndex.current = null;
                      setDragOver(null);
                    }}
                    title="Drag to reorder"
                    className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/70 select-none px-1 text-lg leading-none"
                  >
                    ⠿
                  </span>
                  <input
                    value={l.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="flex-1 min-w-0 bg-white/[0.06] border border-white/[0.12] rounded-md text-white px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={l.quantity}
                    onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    title="Miles / qty"
                    className="w-20 bg-white/[0.06] border border-white/[0.12] rounded-md text-white px-2 py-1 text-sm text-right font-mono"
                  />
                  <span className="text-white/30 text-xs">×</span>
                  <input
                    type="number"
                    step="0.01"
                    value={l.unitAmount}
                    onChange={(e) => updateLine(i, 'unitAmount', e.target.value)}
                    title="Rate"
                    className="w-20 bg-white/[0.06] border border-white/[0.12] rounded-md text-white px-2 py-1 text-sm text-right font-mono"
                  />
                  <span className="w-20 text-right text-white font-mono text-sm">
                    {fmt.format((Number(l.quantity) || 0) * (Number(l.unitAmount) || 0))}
                  </span>
                  <button
                    onClick={() => removeLine(i)}
                    title="Remove line"
                    className="text-white/30 hover:text-red-400 px-1 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-3 text-sm">
              <span className="text-white/60 mr-3">Subtotal</span>
              <span className="text-white font-mono w-28 text-right">
                {fmt.format(
                  editLines.reduce(
                    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitAmount) || 0),
                    0,
                  ),
                )}
              </span>
            </div>
          </div>
        ) : (
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
        )}

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

      {/* Attachments — signed scans, receipts, supporting docs. */}
      <AttachmentsSection
        invoiceId={invoiceId}
        attachments={invoice.attachments ?? []}
        onChange={fetchInvoice}
      />

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

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

function AttachmentsSection({
  invoiceId,
  attachments,
  onChange,
}: {
  invoiceId: string;
  attachments: Attachment[];
  onChange: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setError('');
    setUploading(true);
    try {
      for (const file of list) {
        const safeName =
          (file.name || 'attachment').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) ||
          'attachment';
        const pathname = `invoices/${invoiceId}/${Date.now()}-${safeName}`;

        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: `/api/account/invoices/${invoiceId}/attachments/upload-token`,
          contentType: file.type || 'application/octet-stream',
        });

        const res = await fetch(
          `/api/account/invoices/${invoiceId}/attachments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              blobUrl: blob.url,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
            }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Upload failed (HTTP ${res.status})`);
        }
      }
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (attId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    setDeletingId(attId);
    setError('');
    try {
      const res = await fetch(
        `/api/account/invoices/${invoiceId}/attachments/${attId}`,
        { method: 'DELETE' },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Delete failed (HTTP ${res.status})`);
      }
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm">
      <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/80">Attachments</h3>
          <p className="text-xs text-white/40 mt-0.5">
            Signed scans, receipts, supporting PDFs or images. Up to 25&nbsp;MB each.
          </p>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-semibold rounded-lg px-3 py-1.5 text-sm transition-colors"
        >
          {uploading ? 'Uploading…' : '+ Attach file'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              uploadFiles(e.target.files);
            }
          }}
        />
      </div>

      {/* Drag-drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            uploadFiles(e.dataTransfer.files);
          }
        }}
        className={`mx-5 mt-4 rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors ${
          dragActive
            ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
            : 'border-white/[0.12] text-white/40'
        }`}
      >
        {uploading
          ? 'Uploading…'
          : dragActive
            ? 'Drop to upload'
            : 'Drag & drop files here, or click "Attach file" above. PDF, JPEG, PNG, HEIC, WebP supported.'}
      </div>

      {error && (
        <div className="mx-5 mt-3 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* List */}
      <div className="p-5">
        {attachments.length === 0 ? (
          <p className="text-xs text-white/40 text-center py-4">
            No attachments yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className="text-lg" aria-hidden="true">
                  {fileKindIcon(a.mimeType)}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={a.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-white hover:text-cyan-400 truncate block"
                    title={a.fileName}
                  >
                    {a.fileName}
                  </a>
                  <p className="text-[11px] text-white/40">
                    {formatBytes(a.size)} ·{' '}
                    {new Date(a.uploadedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <a
                  href={a.blobUrl}
                  download={a.fileName}
                  className="text-xs text-white/60 hover:text-white px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.10] transition-colors"
                  title="Download"
                >
                  ↓
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id, a.fileName)}
                  disabled={deletingId === a.id}
                  title="Delete attachment"
                  aria-label={`Delete attachment: ${a.fileName}`}
                  className="text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-colors disabled:opacity-40"
                >
                  {deletingId === a.id ? '…' : '✕'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
