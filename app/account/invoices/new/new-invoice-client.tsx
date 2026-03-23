'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

interface Contact {
  id: string;
  name: string;
  email: string | null;
}

interface Account {
  id: string;
  code: string;
  name: string;
  class: string;
  type: string;
}

interface LineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountId: string;
}

export default function NewInvoiceClient() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contactId, setContactId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [reference, setReference] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitAmount: 0, accountId: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    const [contactsRes, accountsRes] = await Promise.all([
      fetch('/api/account/contacts'),
      fetch('/api/account/accounts'),
    ]);
    if (contactsRes.ok) {
      const json = await contactsRes.json();
      setContacts(json.contacts);
    }
    if (accountsRes.ok) {
      const json = await accountsRes.json();
      setAccounts(json.accounts.filter((a: Account) => a.class === 'REVENUE'));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { description: '', quantity: 1, unitAmount: 0, accountId: '' },
    ]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function lineTotal(item: LineItem) {
    return item.quantity * item.unitAmount;
  }

  const subtotal = lineItems.reduce((sum, item) => sum + lineTotal(item), 0);

  async function handleSave(andSend: boolean) {
    setError('');
    setSaving(true);

    try {
      const validLines = lineItems.filter((l) => l.description.trim() && l.unitAmount > 0);
      if (validLines.length === 0) {
        setError('At least one line item with a description and amount is required.');
        setSaving(false);
        return;
      }

      const body = {
        contactId: contactId || undefined,
        dueDate: dueDate || undefined,
        reference: reference || undefined,
        notes: notes || undefined,
        lineItems: validLines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitAmount: l.unitAmount,
          accountId: l.accountId || undefined,
        })),
      };

      const res = await fetch('/api/account/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to create invoice');
      }

      const invoice = await res.json();

      if (andSend) {
        const sendRes = await fetch(`/api/account/invoices/${invoice.id}/send`, {
          method: 'POST',
        });
        if (!sendRes.ok) {
          // Invoice created but send failed — navigate to detail
          router.push(`/account/invoices/${invoice.id}`);
          return;
        }
      }

      router.push(`/account/invoices/${invoice.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating invoice');
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">New Invoice</h2>
        <button
          onClick={() => router.back()}
          className="text-sm text-white/40 hover:text-white/60"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-6 space-y-5">
        {/* Contact + Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-white/40 mb-1">Contact</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-2 text-sm"
            >
              <option value="">Select contact...</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Issue Date</label>
            <input
              type="date"
              defaultValue={today}
              className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-2 text-sm"
              readOnly
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-white/40 mb-1">Reference</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="PO number, project name, etc."
            className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
          />
        </div>

        {/* Line Items */}
        <div>
          <label className="block text-xs text-white/40 mb-2">Line Items</label>
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 text-xs text-white/30 px-1">
              <div className="col-span-4">Description</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit Price</div>
              <div className="col-span-3">Account</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            {lineItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input
                  className="col-span-4 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                />
                <input
                  className="col-span-1 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-center px-2 py-2 text-sm"
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    updateLineItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
                <input
                  className="col-span-2 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white text-right px-3 py-2 text-sm"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  value={item.unitAmount || ''}
                  onChange={(e) =>
                    updateLineItem(idx, 'unitAmount', parseFloat(e.target.value) || 0)
                  }
                />
                <select
                  className="col-span-3 bg-white/[0.06] border border-white/[0.12] rounded-lg text-white px-2 py-2 text-sm"
                  value={item.accountId}
                  onChange={(e) => updateLineItem(idx, 'accountId', e.target.value)}
                >
                  <option value="">Account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
                <div className="col-span-1 text-right text-white font-mono text-sm">
                  {fmt.format(lineTotal(item))}
                </div>
                <button
                  onClick={() => removeLineItem(idx)}
                  className="col-span-1 text-red-400/60 hover:text-red-400 text-lg text-center"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addLineItem}
            className="mt-2 text-sm text-cyan-400 hover:text-cyan-300"
          >
            + Add Line Item
          </button>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Subtotal</span>
              <span className="text-white font-mono">{fmt.format(subtotal)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold border-t border-white/[0.08] pt-2">
              <span className="text-white">Total</span>
              <span className="text-cyan-400 font-mono">{fmt.format(subtotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-white/40 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes for the invoice..."
            rows={3}
            className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="bg-white/[0.08] hover:bg-white/[0.12] text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-5 py-2.5 text-sm transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
