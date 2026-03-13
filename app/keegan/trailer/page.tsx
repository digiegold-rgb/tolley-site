"use client";

import { useState, useEffect } from "react";
import { computeTrailerSplit } from "@/lib/keegan";
import "@/app/wd/admin/admin.css";

interface TrailerPayment {
  id: string;
  amount: number;
  month: string;
  status: string;
  note: string | null;
}

interface TrailerClient {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  trailerDescription: string;
  monthlyCost: number;
  investmentCost: number;
  installDate: string | null;
  active: boolean;
  confirmed: boolean;
  notes: string | null;
  payments: TrailerPayment[];
}

const STATUS_CYCLE: Record<string, string> = { paid: "late", late: "missed", missed: "paid" };

export default function KeeganTrailerPage() {
  const [clients, setClients] = useState<TrailerClient[]>([]);
  const [role, setRole] = useState<"tolley" | "keegan">("keegan");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", trailerDescription: "", monthlyCost: "0", investmentCost: "0", address: "", phone: "", email: "", notes: "", installDate: "" });

  useEffect(() => {
    Promise.all([
      fetch("/api/keegan/trailer").then(r => r.ok ? r.json() : { clients: [] }),
      fetch("/api/wd/clients").then(r => r.ok ? r.json() : { role: "keegan" }),
    ]).then(([t, wd]) => {
      setClients(t.clients || []);
      setRole(wd.role || "keegan");
      setLoading(false);
    });
  }, []);

  async function refresh() {
    const r = await fetch("/api/keegan/trailer");
    if (r.ok) {
      const d = await r.json();
      setClients(d.clients || []);
    }
  }

  async function handlePaymentStatus(clientId: string, paymentId: string, newStatus: string) {
    setClients(prev => prev.map(c => ({
      ...c,
      payments: c.payments.map(p => p.id === paymentId ? { ...p, status: newStatus } : p),
    })));
    await fetch(`/api/keegan/trailer/${clientId}/payments?paymentId=${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.trailerDescription.trim()) return;
    await fetch("/api/keegan/trailer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        trailerDescription: form.trailerDescription.trim(),
        monthlyCost: parseFloat(form.monthlyCost) || 0,
        investmentCost: parseFloat(form.investmentCost) || 0,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        installDate: form.installDate || null,
      }),
    });
    setForm({ name: "", trailerDescription: "", monthlyCost: "0", investmentCost: "0", address: "", phone: "", email: "", notes: "", installDate: "" });
    setShowAdd(false);
    await refresh();
  }

  async function handleConfirm(clientId: string, val: boolean) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, confirmed: val } : c));
    await fetch(`/api/keegan/trailer/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: val }),
    });
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading trailer clients...</div>;
  }

  const isTolley = role === "tolley";
  const maxPayments = Math.max(1, ...clients.map(c => c.payments.length));

  return (
    <div className="px-2 py-4">
      <div className="max-w-2xl mx-auto mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Trailer Rental</h1>
          <p className="text-xs text-gray-500">50/50 split from dollar one</p>
        </div>
        {isTolley && (
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded hover:bg-gray-800">
            + Add Client
          </button>
        )}
      </div>

      {/* Add client form */}
      {showAdd && (
        <div className="max-w-2xl mx-auto mb-4 bg-white border border-gray-200 rounded-lg p-4">
          <form onSubmit={handleAddClient} className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Client Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Trailer Description *</label>
              <input value={form.trailerDescription} onChange={e => setForm(f => ({ ...f, trailerDescription: e.target.value }))} required placeholder="e.g. 28ft Bumper Pull" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Cost ($)</label>
              <input type="number" value={form.monthlyCost} onChange={e => setForm(f => ({ ...f, monthlyCost: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Investment Cost ($)</label>
              <input type="number" value={form.investmentCost} onChange={e => setForm(f => ({ ...f, investmentCost: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Install Date</label>
              <input type="date" value={form.installDate} onChange={e => setForm(f => ({ ...f, installDate: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1 text-sm text-gray-600">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded">Add</button>
            </div>
          </form>
        </div>
      )}

      {/* Spreadsheet table */}
      <div className="wd-admin">
        <div className="table-scroll">
          <table>
            <thead>
              <tr className="section-header">
                <td colSpan={13 + maxPayments}>Trailer Clients ({clients.length})</td>
              </tr>
              <tr>
                <th>Trailer</th>
                <th>Investment</th>
                <th>Install Date</th>
                <th>Profit</th>
                <th>Client Name</th>
                <th>Total Paid</th>
                <th>&#10003;</th>
                <th>Monthly</th>
                <th>Tolley $</th>
                <th>Keagan $</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Notes</th>
                {Array.from({ length: maxPayments }).map((_, i) => (
                  <th key={i}>Pay {i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={13 + maxPayments} style={{ textAlign: "center", padding: 20, color: "#999" }}>No trailer clients yet</td></tr>
              )}
              {clients.map(client => {
                const totalPaid = client.payments.reduce((s, p) => s + p.amount, 0);
                const profit = totalPaid - client.investmentCost;
                const split = computeTrailerSplit(totalPaid);
                const sorted = [...client.payments].sort((a, b) => a.month.localeCompare(b.month));

                return (
                  <tr key={client.id} className={!client.active ? "inactive-row" : ""}>
                    <td>{client.trailerDescription}</td>
                    <td style={{ textAlign: "right" }}>${client.investmentCost}</td>
                    <td>{client.installDate ? new Date(client.installDate).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" }) : ""}</td>
                    <td style={{ textAlign: "right", color: profit >= 0 ? "#006100" : "#9c0006", fontWeight: 600 }}>${profit.toFixed(0)}</td>
                    <td>{client.name}</td>
                    <td style={{ textAlign: "right" }}>${totalPaid}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" className="confirm-check" checked={client.confirmed} onChange={e => handleConfirm(client.id, e.target.checked)} />
                    </td>
                    <td style={{ textAlign: "right" }}>${client.monthlyCost}/mo</td>
                    <td style={{ textAlign: "right" }}>${split.tolleySplit}</td>
                    <td style={{ textAlign: "right" }}>${split.keeganSplit}</td>
                    <td>{client.address || ""}</td>
                    <td>{client.phone || ""}</td>
                    <td>{client.notes || ""}</td>
                    {sorted.map(p => {
                      const cls = p.status === "paid" ? "pay-paid" : p.status === "late" ? "pay-late" : "pay-missed";
                      return (
                        <td
                          key={p.id}
                          className={cls}
                          style={{ cursor: "pointer", textAlign: "right" }}
                          onClick={() => handlePaymentStatus(client.id, p.id, STATUS_CYCLE[p.status] || "paid")}
                          title={`$${p.amount} — ${p.status}`}
                        >
                          ${p.amount}
                        </td>
                      );
                    })}
                    {Array.from({ length: maxPayments - sorted.length }).map((_, i) => <td key={`e-${i}`} />)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
