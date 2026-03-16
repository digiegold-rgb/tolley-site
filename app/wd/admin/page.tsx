"use client";

import { useState, useEffect } from "react";
import { WdSpreadsheet } from "@/components/wd/admin/wd-spreadsheet";
import { WdSummaryPanel } from "@/components/wd/admin/wd-summary-panel";
import { WdRepairsTable, type RepairItem } from "@/components/wd/admin/wd-repairs-table";
import { WdCharts } from "@/components/wd/admin/wd-charts";
import { WdAddClientModal } from "@/components/wd/admin/wd-add-client-modal";
import type { WdClientData } from "@/components/wd/admin/wd-client-row";

type WdRole = "tolley";
type TabFilter = "all" | "tolley";

export default function WdAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<WdRole | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [clients, setClients] = useState<WdClientData[]>([]);
  const [repairs, setRepairs] = useState<RepairItem[]>([]);
  const [tab, setTab] = useState<TabFilter>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // ─── Auth check on mount ───
  useEffect(() => {
    fetch("/api/wd/clients")
      .then(r => {
        if (r.ok) return r.json();
        throw new Error("Not authed");
      })
      .then(d => {
        setAuthed(true);
        setRole(d.role);
        setClients(d.clients);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // ─── Load repairs when authed ───
  useEffect(() => {
    if (!authed) return;
    fetch("/api/wd/repairs")
      .then(r => r.json())
      .then(setRepairs)
      .catch(() => {});
  }, [authed]);

  // ─── Login ───
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    const res = await fetch("/api/wd/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      const d = await res.json();
      setRole(d.role);
      setAuthed(true);
      // Load data
      const cr = await fetch("/api/wd/clients");
      if (cr.ok) {
        const cd = await cr.json();
        setClients(cd.clients);
      }
    } else {
      setPinError("Invalid PIN");
    }
  }

  // ─── Refresh clients ───
  async function refresh() {
    const r = await fetch("/api/wd/clients");
    if (r.ok) {
      const d = await r.json();
      setClients(d.clients);
    }
  }

  // ─── Payment status change ───
  async function handlePaymentStatus(paymentId: string, status: string) {
    // Find which client owns this payment
    const client = clients.find(c => c.payments.some(p => p.id === paymentId));
    if (!client) return;

    // Optimistic update
    setClients(prev => prev.map(c => ({
      ...c,
      payments: c.payments.map(p => p.id === paymentId ? { ...p, status } : p),
    })));

    await fetch(`/api/wd/clients/${client.id}/payments?paymentId=${paymentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  // ─── Confirm toggle ───
  async function handleConfirmToggle(clientId: string, val: boolean) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, confirmed: val } : c));
    await fetch(`/api/wd/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: val }),
    });
  }

  // ─── Save client fields ───
  async function handleSave(clientId: string, fields: Record<string, string | number>) {
    await fetch(`/api/wd/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    await refresh();
  }

  // ─── Add client ───
  async function handleAddClient(data: {
    name: string;
    unitDescription: string;
    unitCost: number;
    address: string;
    phone: string;
    email: string;
    notes: string;
    source: string;
    paidBy: string;
    installDate: string;
  }) {
    setLoading(true);
    await fetch("/api/wd/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        installDate: data.installDate || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
      }),
    });
    await refresh();
    setLoading(false);
  }

  // ─── Repair CRUD ───
  async function handleAddRepair(name: string, cost: number) {
    const r = await fetch("/api/wd/repairs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cost }),
    });
    if (r.ok) {
      const item = await r.json();
      setRepairs(prev => [...prev, item]);
    }
  }

  async function handleUpdateRepair(id: string, name: string, cost: number) {
    await fetch(`/api/wd/repairs?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cost }),
    });
    setRepairs(prev => prev.map(r => r.id === id ? { ...r, name, cost } : r));
  }

  async function handleDeleteRepair(id: string) {
    await fetch(`/api/wd/repairs?id=${id}`, { method: "DELETE" });
    setRepairs(prev => prev.filter(r => r.id !== id));
  }

  // ─── Auth screen ───
  if (checking) {
    return <div className="auth-screen"><div style={{ color: "#666" }}>Loading...</div></div>;
  }

  if (!authed) {
    return (
      <div className="auth-screen">
        <div className="auth-box">
          <h2>WD Admin</h2>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              inputMode="numeric"
              placeholder="Enter PIN"
              value={pin}
              onChange={e => setPin(e.target.value)}
              style={{ width: "100%", padding: "8px", marginBottom: 8, border: "1px solid #ccc", borderRadius: 3, fontSize: 14, textAlign: "center", boxSizing: "border-box" }}
              autoFocus
            />
            {pinError && <div style={{ color: "#c44", fontSize: 12, marginBottom: 4 }}>{pinError}</div>}
            <button className="btn btn-primary" style={{ width: "100%" }}>Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Top bar */}
      <div className="topbar">
        <span className="title">WD Admin — Tolley</span>
        <div className="actions">
          {role === "tolley" && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)} disabled={loading}>
              + New Client
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* Tab bar */}
        <div className="tab-bar">
          {(["all", "tolley"] as const).map(t => (
            <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "all" ? "All" : "Tolley"}
            </button>
          ))}
        </div>

        {/* Summary */}
        <WdSummaryPanel clients={clients} />

        {/* Spreadsheet */}
        <WdSpreadsheet
          clients={clients}
          role={role!}
          filter={tab}
          onPaymentStatus={handlePaymentStatus}
          onConfirmToggle={handleConfirmToggle}
          onSave={handleSave}
        />

        {/* Bottom section: repairs + charts side by side */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 16 }}>
          <WdRepairsTable
            items={repairs}
            role={role!}
            onAdd={handleAddRepair}
            onUpdate={handleUpdateRepair}
            onDelete={handleDeleteRepair}
          />
          <div style={{ flex: 1, minWidth: 300 }}>
            <WdCharts clients={clients} repairItems={repairs} />
          </div>
        </div>
      </div>

      <WdAddClientModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddClient}
      />
    </div>
  );
}
