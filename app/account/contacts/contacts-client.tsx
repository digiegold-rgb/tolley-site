'use client';

import { useEffect, useState, useCallback } from 'react';

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
  status: string;
  _count: { invoices: number };
}

export default function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // New contact form
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formZip, setFormZip] = useState('');
  const [formIsCustomer, setFormIsCustomer] = useState(true);
  const [formIsSupplier, setFormIsSupplier] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      const res = await fetch(`/api/account/contacts?${params}`);
      if (!res.ok) throw new Error('Failed to load contacts');
      const json = await res.json();
      setContacts(json.contacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  function resetForm() {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormCity('');
    setFormState('');
    setFormZip('');
    setFormIsCustomer(true);
    setFormIsSupplier(false);
  }

  async function handleSubmit() {
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/account/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail || undefined,
          phone: formPhone || undefined,
          address: formAddress || undefined,
          city: formCity || undefined,
          state: formState || undefined,
          zip: formZip || undefined,
          isCustomer: formIsCustomer,
          isSupplier: formIsSupplier,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to create contact');
      }
      resetForm();
      setShowForm(false);
      fetchContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
        >
          {showForm ? 'Cancel' : 'Add Contact'}
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

      {/* Add Contact Form */}
      {showForm && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl backdrop-blur-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/60">New Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/40 mb-1">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Contact name"
                className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Email</label>
              <input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Phone</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-white/40 mb-1">Address</label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Street address"
                className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">City</label>
              <input
                type="text"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-white/40 mb-1">State</label>
                <input
                  type="text"
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  maxLength={2}
                  placeholder="MO"
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Zip</label>
                <input
                  type="text"
                  value={formZip}
                  onChange={(e) => setFormZip(e.target.value)}
                  maxLength={10}
                  placeholder="64055"
                  className="w-full bg-white/[0.06] border border-white/[0.12] rounded-lg text-white placeholder:text-white/30 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsCustomer}
                onChange={(e) => setFormIsCustomer(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/[0.06] accent-cyan-500"
              />
              Customer
            </label>
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsSupplier}
                onChange={(e) => setFormIsSupplier(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/[0.06] accent-cyan-500"
              />
              Supplier
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold rounded-lg px-5 py-2 text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
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
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.08]">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.04]">
                    <td className="px-5 py-3 text-white font-medium">{c.name}</td>
                    <td className="px-5 py-3 text-white/60">{c.email || '—'}</td>
                    <td className="px-5 py-3 text-white/60">{c.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        {c.isCustomer && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400">
                            Customer
                          </span>
                        )}
                        {c.isSupplier && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                            Supplier
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-white/40 font-mono">
                      {c._count.invoices}
                    </td>
                  </tr>
                ))}
                {contacts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-white/30">
                      No contacts found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
