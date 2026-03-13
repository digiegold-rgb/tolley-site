"use client";

import { useState, useEffect } from "react";
import { WdSpreadsheet } from "@/components/wd/admin/wd-spreadsheet";
import type { WdClientData } from "@/components/wd/admin/wd-client-row";
import "@/app/wd/admin/admin.css";

export default function KeeganWdPage() {
  const [clients, setClients] = useState<WdClientData[]>([]);
  const [role, setRole] = useState<"tolley" | "keegan">("keegan");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/wd/clients")
      .then(r => r.ok ? r.json() : { clients: [], role: "keegan" })
      .then(d => {
        setClients(d.clients || []);
        setRole(d.role || "keegan");
        setLoading(false);
      });
  }, []);

  async function handlePaymentStatus(paymentId: string, status: string) {
    const client = clients.find(c => c.payments.some(p => p.id === paymentId));
    if (!client) return;

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

  async function handleConfirmToggle(clientId: string, val: boolean) {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, confirmed: val } : c));
    await fetch(`/api/wd/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: val }),
    });
  }

  async function handleSave(clientId: string, fields: Record<string, string | number>) {
    await fetch(`/api/wd/clients/${clientId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    // Refresh
    const r = await fetch("/api/wd/clients");
    if (r.ok) {
      const d = await r.json();
      setClients(d.clients || []);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading W&D clients...</div>;
  }

  return (
    <div className="px-2 py-4">
      <div className="max-w-2xl mx-auto mb-4">
        <h1 className="text-lg font-bold text-gray-900">W&D Rental — Keagan&apos;s Clients</h1>
        <p className="text-xs text-gray-500">Shared clients with revenue split breakdown</p>
      </div>
      <div className="wd-admin">
        <WdSpreadsheet
          clients={clients}
          role={role}
          filter="keegan"
          onPaymentStatus={handlePaymentStatus}
          onConfirmToggle={handleConfirmToggle}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
