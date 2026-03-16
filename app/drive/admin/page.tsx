"use client";

import { useEffect, useState, useCallback } from "react";

interface Stats {
  totalOrders: number;
  pendingOrders: number;
  activeOrders: number;
  completedOrders: number;
  totalDrivers: number;
  onlineDrivers: number;
  pendingDrivers: number;
  totalClients: number;
  totalRevenue: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  clientPrice: number;
  platformFee: number;
  driverPay: number;
  createdAt: string;
  driver: { name: string } | null;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  status: string;
  isOnline: boolean;
  avgRating: number;
  totalDeliveries: number;
  createdAt: string;
  user: { email: string | null };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tab, setTab] = useState<"overview" | "drivers">("overview");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, driversRes] = await Promise.all([
        fetch("/api/dispatch/admin/dashboard"),
        fetch("/api/dispatch/admin/drivers"),
      ]);

      if (dashRes.ok) {
        const data = await dashRes.json();
        setStats(data.stats);
        setRecentOrders(data.recentOrders || []);
      }

      if (driversRes.ok) {
        const data = await driversRes.json();
        setDrivers(data.drivers || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function approveDriver(driverId: string) {
    await fetch(`/api/dispatch/admin/drivers/${driverId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    fetchData();
  }

  if (loading) {
    return (
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading admin...</div>
      </main>
    );
  }

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">
          Dispatch Admin
        </h1>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Orders", value: stats.totalOrders },
              {
                label: "Active",
                value: stats.pendingOrders + stats.activeOrders,
                color: "text-blue-400",
              },
              {
                label: "Completed",
                value: stats.completedOrders,
                color: "text-green-400",
              },
              {
                label: "Revenue",
                value: `$${stats.totalRevenue.toFixed(2)}`,
                color: "text-green-400",
              },
              {
                label: "Total Drivers",
                value: stats.totalDrivers,
              },
              {
                label: "Online Now",
                value: stats.onlineDrivers,
                color: "text-green-400",
              },
              {
                label: "Pending Approval",
                value: stats.pendingDrivers,
                color: stats.pendingDrivers > 0 ? "text-yellow-400" : undefined,
              },
              { label: "Clients", value: stats.totalClients },
            ].map((s) => (
              <div
                key={s.label}
                className="p-4 bg-gray-900/60 border border-gray-700 rounded-xl"
              >
                <div className="text-xs text-gray-500 uppercase">
                  {s.label}
                </div>
                <div
                  className={`text-2xl font-bold mt-1 ${s.color || "text-white"}`}
                >
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("overview")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === "overview"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            Recent Orders
          </button>
          <button
            onClick={() => setTab("drivers")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              tab === "drivers"
                ? "bg-red-600 text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            Drivers
            {stats && stats.pendingDrivers > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
                {stats.pendingDrivers}
              </span>
            )}
          </button>
        </div>

        {tab === "overview" && (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 bg-gray-900/60 border border-gray-700 rounded-xl"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-sm font-mono text-gray-400">
                      {order.orderNumber}
                    </span>
                    <span className="ml-3 text-xs text-gray-500">
                      {order.status}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-300 truncate">
                  {order.pickupAddress} → {order.dropoffAddress}
                </div>
                <div className="mt-2 flex gap-4 text-sm">
                  <span className="text-white">
                    ${order.clientPrice.toFixed(2)}
                  </span>
                  <span className="text-green-400">
                    Fee: ${order.platformFee.toFixed(2)}
                  </span>
                  {order.driver && (
                    <span className="text-gray-400">
                      Driver: {order.driver.name}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "drivers" && (
          <div className="space-y-3">
            {drivers.map((d) => (
              <div
                key={d.id}
                className="p-4 bg-gray-900/60 border border-gray-700 rounded-xl flex justify-between items-center"
              >
                <div>
                  <div className="text-white font-semibold">
                    {d.name}
                    {d.isOnline && (
                      <span className="ml-2 text-xs text-green-400">
                        ONLINE
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {d.phone} | {d.vehicleType.replace(/_/g, " ")} |{" "}
                    {d.totalDeliveries} deliveries | {d.avgRating.toFixed(1)} stars
                  </div>
                  <div className="text-xs text-gray-500">
                    {d.user.email} | Joined{" "}
                    {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  {d.status === "pending" ? (
                    <button
                      onClick={() => approveDriver(d.id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg"
                    >
                      Approve
                    </button>
                  ) : (
                    <span
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        d.status === "approved"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {d.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
