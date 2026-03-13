"use client";

import { useState, useEffect } from "react";
import { KeeganHubStats } from "@/components/keegan/keegan-hub-stats";
import { KeeganHubCards } from "@/components/keegan/keegan-hub-cards";
import type { PartnerPaymentData } from "@/components/keegan/keegan-payment-ledger";

interface WdClientSlim {
  id: string;
  split: { keeganSplit: number };
}

interface TrailerClientSlim {
  id: string;
  payments: { amount: number }[];
}

export default function KeeganHubPage() {
  const [wdClients, setWdClients] = useState<WdClientSlim[]>([]);
  const [trailerClients, setTrailerClients] = useState<TrailerClientSlim[]>([]);
  const [payments, setPayments] = useState<PartnerPaymentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/wd/clients").then(r => r.ok ? r.json() : { clients: [] }),
      fetch("/api/keegan/trailer").then(r => r.ok ? r.json() : { clients: [] }),
      fetch("/api/keegan/payments").then(r => r.ok ? r.json() : { payments: [] }),
    ]).then(([wd, trailer, pay]) => {
      // Filter WD to only Keagan's clients
      const keeganWd = (wd.clients || []).filter((c: { source: string }) => c.source === "keegan" || c.source === "both");
      setWdClients(keeganWd);
      setTrailerClients(trailer.clients || []);
      setPayments(pay.payments || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-400 text-sm">Loading hub...</div>;
  }

  const wdEarned = wdClients.reduce((s, c) => s + (c.split?.keeganSplit || 0), 0);
  const trailerEarned = trailerClients.reduce((s, c) =>
    s + c.payments.reduce((ps, p) => ps + p.amount, 0) * 0.5, 0);

  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = payments
    .filter(p => p.status === "paid" && p.date.startsWith(thisMonthKey))
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Partnership Hub</h1>
      <p className="text-sm text-gray-500 mb-6">All businesses at a glance</p>

      <KeeganHubStats totalEarned={totalPaid} totalPending={totalPending} thisMonth={thisMonth} />
      <KeeganHubCards
        wdClients={wdClients.length}
        wdEarned={Math.round(wdEarned)}
        trailerClients={trailerClients.length}
        trailerEarned={Math.round(trailerEarned)}
        totalPaid={totalPaid}
        totalPending={totalPending}
      />
    </div>
  );
}
