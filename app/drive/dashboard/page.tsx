"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  clientPrice: number;
  distanceMi: number | null;
  cargoDescription: string;
  createdAt: string;
  driver: { name: string; avgRating: number } | null;
}

export default function ClientDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ contactName: string; totalOrders: number; totalSpent: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, profileRes] = await Promise.all([
        fetch("/api/dispatch/orders?limit=10"),
        fetch("/api/dispatch/client/profile"),
      ]);

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setOrders(data.orders || []);
      }

      if (profileRes.ok) {
        setProfile(await profileRes.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const activeOrders = orders.filter((o) =>
    !["completed", "cancelled", "failed"].includes(o.status)
  );

  if (loading) {
    return (
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </main>
    );
  }

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {profile?.contactName ? `Hi, ${profile.contactName}` : "Dashboard"}
            </h1>
            {profile && (
              <p className="text-sm text-gray-400">
                {profile.totalOrders} orders | ${profile.totalSpent.toFixed(2)}{" "}
                total
              </p>
            )}
          </div>
          <Link
            href="/drive/dashboard/order"
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg lm-glow transition-colors"
          >
            New Delivery
          </Link>
        </div>

        {/* Active orders */}
        {activeOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4">
              Active Deliveries
            </h2>
            <div className="space-y-4">
              {activeOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/drive/track/${order.orderNumber}`}
                  className="block p-5 bg-gray-900/60 border border-gray-700 rounded-xl hover:border-red-700/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-mono text-gray-400">
                      {order.orderNumber}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-900/40 text-blue-400">
                      {order.status.replace(/_/g, " ").toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-300">
                    {order.pickupAddress} → {order.dropoffAddress}
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-400">
                      {order.cargoDescription}
                    </span>
                    <span className="text-white font-semibold">
                      ${order.clientPrice.toFixed(2)}
                    </span>
                  </div>
                  {order.driver && (
                    <div className="mt-2 text-sm text-green-400">
                      Driver: {order.driver.name} ({order.driver.avgRating.toFixed(1)} stars)
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent orders */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Recent Orders</h2>
          <Link
            href="/drive/dashboard/history"
            className="text-sm text-red-400 hover:text-red-300"
          >
            View All →
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 bg-gray-900/60 border border-gray-700 rounded-xl text-center">
            <p className="text-gray-400 mb-4">No deliveries yet</p>
            <Link
              href="/drive/dashboard/order"
              className="inline-block px-6 py-3 bg-red-600 text-white font-semibold rounded-lg"
            >
              Create Your First Order
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => (
              <Link
                key={order.id}
                href={`/drive/track/${order.orderNumber}`}
                className="block p-4 bg-gray-900/60 border border-gray-700 rounded-xl hover:border-gray-500 transition-colors"
              >
                <div className="flex justify-between">
                  <span className="text-sm font-mono text-gray-400">
                    {order.orderNumber}
                  </span>
                  <span className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-sm text-gray-300 truncate mr-4">
                    {order.dropoffAddress}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      order.status === "completed"
                        ? "text-green-400"
                        : order.status === "cancelled"
                          ? "text-red-400"
                          : "text-gray-300"
                    }`}
                  >
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
