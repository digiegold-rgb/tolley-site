"use client";

import { useState } from "react";

export default function LeadsPricingActions({
  tierId,
  interval = "monthly",
  isLoggedIn,
  isCurrent,
}: {
  tierId: string;
  interval?: "monthly" | "annual";
  isLoggedIn: boolean;
  isCurrent: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    if (!isLoggedIn) {
      window.location.href = "/login?callbackUrl=/leads/pricing";
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/leads/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: tierId, interval }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (isCurrent) {
    return (
      <button
        disabled
        className="w-full rounded-lg bg-green-500/20 border border-green-500/30 px-4 py-2.5 text-sm font-medium text-green-300"
      >
        Current Plan
      </button>
    );
  }

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        loading
          ? "bg-white/10 text-white/30 cursor-wait"
          : "bg-white/10 border border-white/20 text-white hover:bg-white/20"
      }`}
    >
      {loading ? "Loading..." : isLoggedIn ? "Subscribe" : "Sign up to subscribe"}
    </button>
  );
}
