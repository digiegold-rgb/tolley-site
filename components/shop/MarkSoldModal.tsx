"use client";

/**
 * Buyer-contact capture at the point of sale. Fires when Ruthann clicks
 * "Sold" in the inventory table — previously that was a single fetch with
 * no buyer info captured, which is why ShopSale had 0 rows even after 562
 * manual sales (see Shared/amazon-push/drafts.md finding). All three fields
 * plus the opt-in checkbox are optional and default empty/unchecked; "Mark
 * Sold" always works with nothing filled in, so this never blocks the sale.
 *
 * marketingOptIn MUST default false — Amazon's opted-in-messaging rule
 * requires affirmative consent, not silence, before a past buyer can be sent
 * affiliate links via SMS/WhatsApp.
 */
import { useState } from "react";

interface MarkSoldModalProps {
  product: { id: string; title: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function MarkSoldModal({ product, onClose, onSuccess }: MarkSoldModalProps) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [saving, setSaving] = useState(false);

  async function markSold() {
    setSaving(true);
    try {
      const res = await fetch(`/api/shop/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "sold",
          buyerName: buyerName.trim() || undefined,
          buyerPhone: buyerPhone.trim() || undefined,
          buyerEmail: buyerEmail.trim() || undefined,
          marketingOptIn,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      onSuccess();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0c0b14] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Mark Sold</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/60 text-lg">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-white/40 truncate">{product.title}</p>

        <p className="mt-3 text-xs text-white/30">
          Optional — only fill in if the buyer wants deal texts. Skip and hit
          Mark Sold if not.
        </p>

        <div className="mt-2 space-y-2">
          <input
            type="text"
            placeholder="Buyer name (optional)"
            value={buyerName}
            onChange={(e) => setBuyerName(e.target.value)}
            className="shop-input w-full rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="tel"
            placeholder="Buyer phone (optional)"
            value={buyerPhone}
            onChange={(e) => setBuyerPhone(e.target.value)}
            className="shop-input w-full rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Buyer email (optional)"
            value={buyerEmail}
            onChange={(e) => setBuyerEmail(e.target.value)}
            className="shop-input w-full rounded-lg px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 pt-1 text-xs text-white/60">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="h-4 w-4 rounded border-white/20"
            />
            Buyer said OK to text/message about future deals
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={markSold}
            disabled={saving}
            className="shop-btn-primary flex-1 rounded-lg py-3 text-sm"
          >
            {saving ? "Saving…" : "Mark Sold"}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 px-4 py-3 text-sm text-white/50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
