'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface RegularRun {
  id: string;
  label: string;
  dropLocation: string;
  billingMode: string;
  miles: number;
  rate: number;
  notes: string | null;
  lastUsedAt: string | null;
}

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  total: number;
  amountDue: number;
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
  isCustomer: boolean;
  isSupplier: boolean;
  regularRuns: RegularRun[];
  invoices: InvoiceRow[];
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-white/10 text-white/60',
  SENT: 'bg-amber-500/20 text-amber-300',
  PAID: 'bg-emerald-500/20 text-emerald-300',
  OVERDUE: 'bg-red-500/20 text-red-300',
  VOID: 'bg-white/5 text-white/30 line-through',
};

const inputCls =
  'w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm';

type RunForm = {
  label: string;
  dropLocation: string;
  billingMode: string;
  miles: string;
  rate: string;
  notes: string;
};
const emptyForm: RunForm = {
  label: '',
  dropLocation: '',
  billingMode: 'MILEAGE',
  miles: '',
  rate: '3',
  notes: '',
};

export default function ContactDetailClient({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyRunId, setBusyRunId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // add / edit form state
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<RunForm>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RunForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/account/contacts/${contactId}`);
      if (!res.ok) throw new Error('Failed to load contact');
      const json = await res.json();
      setContact(json.contact);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "New" → create a DRAFT invoice from a run (optionally bundling selected
  // extras for a multi-drop day), then jump to the invoice to attach the PDF & send.
  async function newDraft(runId: string, bundle = false) {
    setBusyRunId(runId);
    setError('');
    try {
      const extra = bundle ? [...selected].filter((rid) => rid !== runId) : [];
      const res = await fetch(
        `/api/account/contacts/${contactId}/regular-runs/${runId}/draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extra.length ? { runIds: extra } : {}),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create draft');
      router.push(`/account/invoices/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setBusyRunId(null);
    }
  }

  async function createRun() {
    const needsMiles = addForm.billingMode !== 'FLAT';
    if (!addForm.label.trim() || !addForm.dropLocation.trim() || (needsMiles && !addForm.miles)) {
      setError(needsMiles ? 'Label, drop location and miles are required' : 'Label and drop location are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/account/contacts/${contactId}/regular-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: addForm.label,
          dropLocation: addForm.dropLocation,
          billingMode: addForm.billingMode,
          miles: needsMiles ? Number(addForm.miles) : 1,
          rate: Number(addForm.rate || 0),
          notes: addForm.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save run');
      setAddForm(emptyForm);
      setShowAdd(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(run: RegularRun) {
    setEditId(run.id);
    setEditForm({
      label: run.label,
      dropLocation: run.dropLocation,
      billingMode: run.billingMode,
      miles: String(run.miles),
      rate: String(run.rate),
      notes: run.notes ?? '',
    });
  }

  async function saveEdit() {
    if (!editId) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(
        `/api/account/contacts/${contactId}/regular-runs/${editId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            label: editForm.label,
            dropLocation: editForm.dropLocation,
            billingMode: editForm.billingMode,
            miles: editForm.billingMode === 'FLAT' ? 1 : Number(editForm.miles),
            rate: Number(editForm.rate || 0),
            notes: editForm.notes,
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update run');
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRun(runId: string) {
    if (!confirm('Remove this regular run? Existing invoices are unaffected.')) return;
    setError('');
    try {
      const res = await fetch(
        `/api/account/contacts/${contactId}/regular-runs/${runId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove run');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(runId);
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-4">
        <Link href="/account/contacts" className="text-cyan-400 text-sm hover:underline">
          ← Contacts
        </Link>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error || 'Contact not found'}
        </div>
      </div>
    );
  }

  const runs = contact.regularRuns;
  const selectedCount = selected.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/account/contacts" className="text-cyan-400 text-sm hover:underline">
          ← Contacts
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">{contact.name}</h1>
            <div className="text-sm text-white/50 mt-0.5">
              {contact.email || '—'}
              {contact.phone ? ` · ${contact.phone}` : ''}
            </div>
          </div>
          <div className="flex gap-1">
            {contact.isCustomer && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400">
                Customer
              </span>
            )}
            {contact.isSupplier && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                Supplier
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 underline text-xs">
            dismiss
          </button>
        </div>
      )}

      {/* Regular Runs */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-white/80">Regular Runs</h2>
            <p className="text-xs text-white/40 mt-0.5">
              One click drafts an invoice pre-filled with the drop and miles × rate. Then attach
              the PDF and send.
            </p>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white/80 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap"
          >
            {showAdd ? 'Cancel' : '+ Add run'}
          </button>
        </div>

        {/* Multi-drop bar */}
        {selectedCount > 1 && (
          <div className="flex items-center justify-between gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-4 py-2.5">
            <span className="text-xs text-cyan-200">
              {selectedCount} runs selected — bundle into one multi-drop invoice
            </span>
            <button
              onClick={() => newDraft([...selected][0], true)}
              disabled={busyRunId !== null}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
            >
              New multi-drop invoice
            </button>
          </div>
        )}

        {/* Add form */}
        {showAdd && (
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-4 space-y-3">
            {/* Billing mode */}
            <div className="flex gap-1 w-fit rounded-lg bg-white/[0.04] p-0.5">
              {[
                { v: 'MILEAGE', label: 'Per mile' },
                { v: 'FLAT', label: 'Flat / weight-based' },
              ].map((m) => (
                <button
                  key={m.v}
                  onClick={() => setAddForm({ ...addForm, billingMode: m.v })}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    addForm.billingMode === m.v
                      ? 'bg-cyan-500 text-black font-semibold'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Label *</label>
                <input
                  className={inputCls}
                  placeholder={addForm.billingMode === 'FLAT' ? 'Guadalupe — Main St stop' : 'Gaumats — Grain Valley'}
                  value={addForm.label}
                  onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Drop location (line description) *</label>
                <input
                  className={inputCls}
                  placeholder="1251 NW Granite Dr, Grain Valley, MO"
                  value={addForm.dropLocation}
                  onChange={(e) => setAddForm({ ...addForm, dropLocation: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {addForm.billingMode !== 'FLAT' && (
                  <div>
                    <label className="block text-xs text-white/40 mb-1">Miles *</label>
                    <input
                      className={inputCls}
                      type="number"
                      inputMode="decimal"
                      placeholder="38"
                      value={addForm.miles}
                      onChange={(e) => setAddForm({ ...addForm, miles: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-white/40 mb-1">
                    {addForm.billingMode === 'FLAT' ? 'Default $ (edit each week)' : '$/mile'}
                  </label>
                  <input
                    className={inputCls}
                    type="number"
                    inputMode="decimal"
                    value={addForm.rate}
                    onChange={(e) => setAddForm({ ...addForm, rate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Notes (optional)</label>
                <input
                  className={inputCls}
                  placeholder={addForm.billingMode === 'FLAT' ? 'e.g. price scales with weight limit' : ''}
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">
                {addForm.billingMode === 'FLAT'
                  ? addForm.rate && Number(addForm.rate) > 0
                    ? `≈ ${money(Number(addForm.rate))} default (adjust per week)`
                    : ''
                  : addForm.miles && Number(addForm.miles) > 0
                    ? `= ${money(Number(addForm.miles) * Number(addForm.rate || 3))} per run`
                    : ''}
              </span>
              <button
                onClick={createRun}
                disabled={saving}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-1.5 text-sm transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save run'}
              </button>
            </div>
          </div>
        )}

        {/* Run list */}
        {runs.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-8">
            No regular runs yet. Add one above to enable one-click invoicing.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {runs.map((run) => {
              const total = run.miles * run.rate;
              const isEditing = editId === run.id;
              const isSelected = selected.has(run.id);
              return (
                <div
                  key={run.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    isSelected
                      ? 'border-cyan-500/50 bg-cyan-500/[0.06]'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex gap-1 w-fit rounded-lg bg-white/[0.04] p-0.5">
                        {[
                          { v: 'MILEAGE', label: 'Per mile' },
                          { v: 'FLAT', label: 'Flat / weight' },
                        ].map((m) => (
                          <button
                            key={m.v}
                            onClick={() => setEditForm({ ...editForm, billingMode: m.v })}
                            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                              editForm.billingMode === m.v
                                ? 'bg-cyan-500 text-black font-semibold'
                                : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <input
                        className={inputCls}
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                      />
                      <input
                        className={inputCls}
                        value={editForm.dropLocation}
                        onChange={(e) => setEditForm({ ...editForm, dropLocation: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        {editForm.billingMode !== 'FLAT' && (
                          <input
                            className={inputCls}
                            type="number"
                            value={editForm.miles}
                            onChange={(e) => setEditForm({ ...editForm, miles: e.target.value })}
                            placeholder="Miles"
                          />
                        )}
                        <input
                          className={inputCls}
                          type="number"
                          value={editForm.rate}
                          onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })}
                          placeholder={editForm.billingMode === 'FLAT' ? 'Default $' : '$/mi'}
                        />
                      </div>
                      <input
                        className={inputCls}
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        placeholder="Notes (optional)"
                      />
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          onClick={() => setEditId(null)}
                          className="text-white/50 hover:text-white/80 text-xs px-2 py-1"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-3 py-1 text-xs disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(run.id)}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/[0.06] accent-cyan-500"
                          title="Select to bundle into a multi-drop invoice"
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
                          <div className="text-white/50 text-xs mt-0.5 truncate">
                            {run.dropLocation}
                          </div>
                          <div className="text-white/40 text-xs mt-1 font-mono">
                            {run.billingMode === 'FLAT' ? (
                              <span className="text-cyan-300">
                                {run.rate > 0 ? `≈ ${money(run.rate)} (set weekly)` : 'set weekly'}
                              </span>
                            ) : (
                              <>
                                {run.miles} mi × {money(run.rate)} ={' '}
                                <span className="text-cyan-300">{money(total)}</span>
                              </>
                            )}
                          </div>
                          {run.notes && (
                            <div className="text-amber-300/70 text-[11px] mt-1 leading-snug">
                              {run.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(run)}
                            className="text-white/40 hover:text-white/80 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRun(run.id)}
                            className="text-white/40 hover:text-red-400 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                        <button
                          onClick={() => newDraft(run.id)}
                          disabled={busyRunId !== null}
                          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-1.5 text-xs transition-colors disabled:opacity-50"
                        >
                          {busyRunId === run.id ? 'Creating…' : 'New'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invoice history */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.08]">
          <h2 className="text-sm font-semibold text-white/80">Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.08]">
                <th className="px-5 py-3">Number</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">For</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-right">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {contact.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-white/[0.04] cursor-pointer"
                  onClick={() => router.push(`/account/invoices/${inv.id}`)}
                >
                  <td className="px-5 py-3 text-cyan-400 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-5 py-3 text-white/60">
                    {new Date(inv.issueDate).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-5 py-3 text-white/60 max-w-[16rem] truncate">
                    {inv.reference || '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        STATUS_STYLES[inv.status] || 'bg-white/10 text-white/60'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-white/80 font-mono">
                    {money(inv.total)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-white/60">
                    {inv.amountDue > 0 ? money(inv.amountDue) : '—'}
                  </td>
                </tr>
              ))}
              {contact.invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-white/30">
                    No invoices yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
