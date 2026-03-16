"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  clientPrice: number;
  driverPay: number;
  distanceMi: number | null;
  cargoDescription: string;
  createdAt: string;
  completedAt: string | null;
  driver: { name: string; avgRating: number } | null;
}

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dispatch/orders?limit=100")
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, []);

  const statusColor: Record<string, string> = {
    completed: "text-green-400",
    cancelled: "text-red-400",
    failed: "text-red-400",
    pending: "text-yellow-400",
    matching: "text-blue-400",
    accepted: "text-blue-400",
  };

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Order History</h1>
          <Link
            href="/drive/dashboard"
            className="text-sm text-red-400 hover:text-red-300"
          >
            ← Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="text-center text-gray-400 py-8">No orders yet</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/drive/track/${order.orderNumber}`}
                className="block p-4 bg-gray-900/60 border border-gray-700 rounded-xl hover:border-gray-500 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-mono text-gray-400">
                      {order.orderNumber}
                    </span>
                    <span
                      className={`ml-3 text-xs font-semibold ${statusColor[order.status] || "text-gray-400"}`}
                    >
                      {order.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-2 text-sm text-gray-300 truncate">
                  {order.pickupAddress} → {order.dropoffAddress}
                </div>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-gray-400">
                    {order.cargoDescription}
                    {order.distanceMi ? ` | ${order.distanceMi} mi` : ""}
                  </span>
                  <span className="text-white font-semibold">
                    ${order.clientPrice.toFixed(2)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
