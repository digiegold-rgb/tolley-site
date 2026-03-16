"use client";

import { AffiliateManager } from "@/components/shop/AffiliateManager";

export default function AffiliatesPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-white">Affiliate Links</h1>
      <p className="mt-1 text-sm text-white/40">
        Manage affiliate shortlinks. Share via tolley.io/go/CODE
      </p>

      <div className="mt-6">
        <AffiliateManager />
      </div>
    </div>
  );
}
