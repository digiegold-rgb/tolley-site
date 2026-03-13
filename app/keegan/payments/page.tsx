"use client";

import { useState, useEffect } from "react";
import { KeeganPaymentLedger, type PartnerPaymentData } from "@/components/keegan/keegan-payment-ledger";
import { KeeganAddPayment } from "@/components/keegan/keegan-add-payment";

export default function KeeganPaymentsPage() {
  const [payments, setPayments] = useState<PartnerPaymentData[]>([]);
  const [role, setRole] = useState<"tolley" | "keegan">("keegan");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/keegan/payments").then(r => r.ok ? r.json() : { payments: [] }),
      fetch("/api/wd/clients").then(r => r.ok ? r.json() : { role: "keegan" }),
    ]).then(([pay, wd]) => {
      setPayments(pay.payments || []);
      setRole(wd.role || "keegan");
      setLoading(false);
    });
  }, []);

  async function handleAdd(data: {
    amount: number;
    date: string;
    description: string;
    category: string;
    status: string;
  }) {
    const res = await fetch("/api/keegan/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const p = await res.json();
      setPayments(prev => [...prev, p]);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/keegan/payments/${id}`, { method: "DELETE" });
    setPayments(prev => prev.filter(p => p.id !== id));
  }

  async function handleUpdate(id: string, data: Partial<PartnerPaymentData>) {
    const res = await fetch(`/api/keegan/payments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setPayments(prev => prev.map(p => p.id === id ? { ...updated } : p));
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading payments...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Payment Ledger</h1>
          <p className="text-xs text-gray-500">All payments to Keagan across all businesses</p>
        </div>
        {role === "tolley" && <KeeganAddPayment onSubmit={handleAdd} />}
      </div>

      <KeeganPaymentLedger payments={payments} role={role} onDelete={handleDelete} onUpdate={handleUpdate} />
    </div>
  );
}
