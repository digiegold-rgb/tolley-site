"use client";

import { useEffect, useState, useCallback } from "react";

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  isOnline: boolean;
  avgRating: number;
  totalDeliveries: number;
  completionRate: number;
  status: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceMi: number | null;
  driverPay: number;
  cargoDescription: string;
  acceptedAt: string | null;
}

export default function DriverDashboardPage() {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [profileRes, ordersRes] = await Promise.all([
        fetch("/api/dispatch/driver/profile"),
        fetch("/api/dispatch/driver/orders?type=active"),
      ]);

      if (profileRes.ok) {
        setDriver(await profileRes.json());
      } else {
        setError("Not registered as a driver");
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setActiveOrders(data.orders || []);
      }
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // GPS tracking
  useEffect(() => {
    if (!driver?.isOnline) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        fetch("/api/dispatch/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [driver?.isOnline]);

  async function toggleOnline() {
    if (!driver) return;

    // Get current position first
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
      });
    }).catch(() => null);

    const res = await fetch("/api/dispatch/driver/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isOnline: !driver.isOnline,
        ...(pos && {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      }),
    });

    if (res.ok) {
      setDriver((d) => (d ? { ...d, isOnline: !d.isOnline } : d));
    }
  }

  async function updateOrderStatus(orderId: string) {
    const res = await fetch(
      `/api/dispatch/driver/orders/${orderId}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );

    if (res.ok) fetchData();
  }

  if (loading) {
    return (
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading dashboard...</div>
      </main>
    );
  }

  if (error || !driver) {
    return (
      <main className="relative z-10 min-h-screen py-12 px-4 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">Driver Dashboard</h1>
        <p className="text-gray-400">{error || "Not registered"}</p>
        <a
          href="/drive/register"
          className="inline-block mt-4 px-6 py-3 bg-red-600 text-white font-semibold rounded-lg"
        >
          Register as Driver
        </a>
      </main>
    );
  }

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{driver.name}</h1>
            <p className="text-sm text-gray-400">
              {driver.vehicleType.replace(/_/g, " ")} | {driver.totalDeliveries}{" "}
              deliveries | {driver.avgRating.toFixed(1)} stars
            </p>
          </div>

          {driver.status === "approved" ? (
            <button
              onClick={toggleOnline}
              className={`px-6 py-3 rounded-full font-bold text-lg transition-all ${
                driver.isOnline
                  ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              {driver.isOnline ? "ONLINE" : "OFFLINE"}
            </button>
          ) : (
            <span className="px-4 py-2 bg-yellow-900/40 border border-yellow-700 rounded-lg text-yellow-400 text-sm">
              Status: {driver.status}
            </span>
          )}
        </div>

        {driver.status === "pending" && (
          <div className="p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-lg mb-6">
            <p className="text-yellow-400">
              Your application is under review. We&apos;ll notify you by SMS when
              approved.
            </p>
          </div>
        )}

        {/* Active Orders */}
        <h2 className="text-xl font-bold text-white mb-4">Active Deliveries</h2>
        {activeOrders.length === 0 ? (
          <div className="p-8 bg-gray-900/60 border border-gray-700 rounded-xl text-center">
            <p className="text-gray-400">
              {driver.isOnline
                ? "No active deliveries. We'll text you when an order comes in."
                : "Go online to start receiving orders."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className="p-5 bg-gray-900/60 border border-gray-700 rounded-xl"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-sm font-mono text-gray-400">
                    {order.orderNumber}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      order.status === "accepted"
                        ? "bg-blue-900/40 text-blue-400"
                        : order.status === "picked_up" ||
                            order.status === "delivering"
                          ? "bg-green-900/40 text-green-400"
                          : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {order.status.replace(/_/g, " ").toUpperCase()}
                  </span>
                </div>

                <div className="text-sm space-y-1 mb-3">
                  <p className="text-gray-300">
                    <span className="text-gray-500">From:</span>{" "}
                    {order.pickupAddress}
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-500">To:</span>{" "}
                    {order.dropoffAddress}
                  </p>
                  <p className="text-gray-400">{order.cargoDescription}</p>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-green-400 font-bold text-lg">
                    ${order.driverPay.toFixed(2)}
                  </span>
                  <button
                    onClick={() => updateOrderStatus(order.id)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm transition-colors"
                  >
                    Next Step →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="mt-8 flex gap-4">
          <a
            href="/drive/driver/earnings"
            className="flex-1 p-4 bg-gray-900/60 border border-gray-700 rounded-xl text-center hover:border-gray-500 transition-colors"
          >
            <div className="text-sm text-gray-400">Earnings</div>
            <div className="text-lg font-bold text-white">View All</div>
          </a>
          <a
            href="/drive/driver"
            className="flex-1 p-4 bg-gray-900/60 border border-gray-700 rounded-xl text-center hover:border-gray-500 transition-colors"
          >
            <div className="text-sm text-gray-400">Deliveries</div>
            <div className="text-lg font-bold text-white">
              {driver.totalDeliveries}
            </div>
          </a>
        </div>
      </div>
    </main>
  );
}
