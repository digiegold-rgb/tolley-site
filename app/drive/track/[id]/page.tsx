"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  cargoDescription: string;
  distanceMi: number | null;
  durationMin: number | null;
  clientPrice: number;
  platformFee: number;
  driverPay: number;
  industryEstimate: number | null;
  clientSavings: number | null;
  pickupPhotoUrl: string | null;
  dropoffPhotoUrl: string | null;
  createdAt: string;
  acceptedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  driver: {
    name: string;
    vehicleType: string;
    vehicleDetails: string | null;
    avgRating: number;
    currentLat: number | null;
    currentLng: number | null;
  } | null;
}

const STATUS_STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "matching", label: "Finding Driver" },
  { key: "accepted", label: "Driver Accepted" },
  { key: "pickup_enroute", label: "En Route to Pickup" },
  { key: "picked_up", label: "Picked Up" },
  { key: "delivering", label: "On the Way" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Complete" },
];

export default function TrackingPage() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/dispatch/orders/${id}`);
      if (!res.ok) {
        setError("Order not found");
        return;
      }
      setOrder(await res.json());
    } catch {
      setError("Failed to load order");
    }
  }, [id]);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  if (error) {
    return (
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Order Not Found
          </h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading tracking...</div>
      </main>
    );
  }

  const currentStepIdx = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "cancelled";
  const isFailed = order.status === "failed";

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-sm font-mono text-gray-400">
            {order.orderNumber}
          </h1>
          <div className="text-3xl font-extrabold text-white mt-1">
            {isCancelled
              ? "Cancelled"
              : isFailed
                ? "Failed"
                : STATUS_STEPS[currentStepIdx]?.label || order.status}
          </div>
        </div>

        {/* Status progress */}
        {!isCancelled && !isFailed && (
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              {/* Progress line */}
              <div className="absolute left-0 right-0 top-3 h-0.5 bg-gray-700" />
              <div
                className="absolute left-0 top-3 h-0.5 bg-red-500 transition-all duration-500"
                style={{
                  width: `${(currentStepIdx / (STATUS_STEPS.length - 1)) * 100}%`,
                }}
              />

              {STATUS_STEPS.map((step, i) => (
                <div
                  key={step.key}
                  className="relative flex flex-col items-center"
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      i <= currentStepIdx
                        ? "bg-red-600 border-red-600"
                        : "bg-gray-900 border-gray-600"
                    } ${i === currentStepIdx ? "ring-2 ring-red-400 ring-offset-2 ring-offset-gray-950" : ""}`}
                  />
                  <span
                    className={`text-xs mt-2 ${
                      i <= currentStepIdx ? "text-gray-300" : "text-gray-600"
                    } hidden sm:block`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Map embed */}
        {order.driver?.currentLat && order.driver?.currentLng && (
          <div className="mb-6 rounded-xl overflow-hidden border border-gray-700">
            <iframe
              src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&origin=${order.driver.currentLat},${order.driver.currentLng}&destination=${order.dropoffLat},${order.dropoffLng}&mode=driving`}
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}

        {/* Route info */}
        <div className="p-5 bg-gray-900/60 border border-gray-700 rounded-xl mb-4">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500 uppercase">Pickup</div>
              <div className="text-gray-300">{order.pickupAddress}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Dropoff</div>
              <div className="text-gray-300">{order.dropoffAddress}</div>
            </div>
            <div className="flex gap-6 text-sm text-gray-400 pt-2 border-t border-gray-700">
              {order.distanceMi && <span>{order.distanceMi} mi</span>}
              {order.durationMin && <span>~{order.durationMin} min</span>}
              <span>{order.cargoDescription}</span>
            </div>
          </div>
        </div>

        {/* Driver info */}
        {order.driver && (
          <div className="p-5 bg-gray-900/60 border border-gray-700 rounded-xl mb-4">
            <div className="text-xs text-gray-500 uppercase mb-2">
              Your Driver
            </div>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-white font-semibold">
                  {order.driver.name}
                </div>
                <div className="text-sm text-gray-400">
                  {order.driver.vehicleDetails ||
                    order.driver.vehicleType.replace(/_/g, " ")}{" "}
                  | {order.driver.avgRating.toFixed(1)} stars
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing */}
        <div className="p-5 bg-gray-900/60 border border-gray-700 rounded-xl mb-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Your price</span>
            <span className="text-2xl font-bold text-white">
              ${order.clientPrice.toFixed(2)}
            </span>
          </div>
          {order.clientSavings && order.clientSavings > 0 && (
            <div className="mt-2 text-sm text-green-400">
              Saving ${order.clientSavings.toFixed(2)} vs industry rate
            </div>
          )}
        </div>

        {/* Photos */}
        {(order.pickupPhotoUrl || order.dropoffPhotoUrl) && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            {order.pickupPhotoUrl && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">
                  Pickup Photo
                </div>
                <img
                  src={order.pickupPhotoUrl}
                  alt="Pickup"
                  className="rounded-lg border border-gray-700 w-full"
                />
              </div>
            )}
            {order.dropoffPhotoUrl && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">
                  Delivery Photo
                </div>
                <img
                  src={order.dropoffPhotoUrl}
                  alt="Delivery"
                  className="rounded-lg border border-gray-700 w-full"
                />
              </div>
            )}
          </div>
        )}

        {/* Timestamps */}
        <div className="p-4 bg-gray-900/40 border border-gray-700/50 rounded-xl text-xs text-gray-500 space-y-1">
          <div>
            Created: {new Date(order.createdAt).toLocaleString()}
          </div>
          {order.acceptedAt && (
            <div>
              Accepted: {new Date(order.acceptedAt).toLocaleString()}
            </div>
          )}
          {order.pickedUpAt && (
            <div>
              Picked up: {new Date(order.pickedUpAt).toLocaleString()}
            </div>
          )}
          {order.deliveredAt && (
            <div>
              Delivered: {new Date(order.deliveredAt).toLocaleString()}
            </div>
          )}
          {order.completedAt && (
            <div>
              Completed: {new Date(order.completedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
