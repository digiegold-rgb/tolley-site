"use client";

import { useState } from "react";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/keegan";

export interface PartnerPaymentData {
  id: string;
  amount: number;
  date: string;
  description: string;
  category: string;
  status: string;
}

interface Props {
  payments: PartnerPaymentData[];
  role: "tolley" | "keegan";
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<PartnerPaymentData>) => void;
}

type CategoryFilter = "all" | "wd" | "trailer" | "labor" | "other";

export function KeeganPaymentLedger({ payments, role, onDelete, onUpdate }: Props) {
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const filtered = filter === "all" ? payments : payments.filter(p => p.category === filter);
  const sorted = [...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const total = sorted.reduce((s, p) => s + p.amount, 0);
  const isTolley = role === "tolley";

  return (
    <div>
      {/* Category filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "wd", "trailer", "labor", "other"] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
              filter === cat
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Date</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
              <th className="text-left px-3 py-2 font-semibold text-gray-600">Category</th>
              <th className="text-right px-3 py-2 font-semibold text-gray-600">Amount</th>
              <th className="text-center px-3 py-2 font-semibold text-gray-600">Status</th>
              {isTolley && <th className="px-3 py-2 w-16" />}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={isTolley ? 6 : 5} className="text-center py-6 text-gray-400">No payments recorded</td></tr>
            )}
            {sorted.map(p => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-700">
                  {new Date(p.date).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })}
                </td>
                <td className="px-3 py-2 text-gray-900">{p.description}</td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                    style={{ background: CATEGORY_COLORS[p.category] || "#999" }}
                  >
                    {CATEGORY_LABELS[p.category] || p.category}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-semibold">${p.amount.toLocaleString()}</td>
                <td className="px-3 py-2 text-center">
                  {isTolley ? (
                    <button
                      onClick={() => onUpdate(p.id, { status: p.status === "paid" ? "pending" : "paid" })}
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        p.status === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {p.status}
                    </button>
                  ) : (
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      p.status === "paid" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {p.status}
                    </span>
                  )}
                </td>
                {isTolley && (
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => onDelete(p.id)} className="text-red-400 hover:text-red-600 text-xs">
                      &#10005;
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {/* Running total */}
            <tr className="bg-gray-50 font-bold">
              <td colSpan={3} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2 text-right">${total.toLocaleString()}</td>
              <td colSpan={isTolley ? 2 : 1} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
