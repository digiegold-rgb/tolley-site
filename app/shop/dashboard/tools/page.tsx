"use client";

import Link from "next/link";
import { EbayConnectionCard } from "@/components/shop/EbayConnectionCard";
import { FbBackfillCard } from "@/components/shop/FbBackfillCard";
import { PublishHiddenCard } from "@/components/shop/PublishHiddenCard";
import { BlocklistCard } from "@/components/shop/BlocklistCard";

export default function ToolsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Tools</h1>
        <p className="mt-1 text-sm text-white/50">
          Bulk actions and platform connections. Single-product edits live in the
          Inventory table on{" "}
          <Link href="/shop/dashboard" className="text-purple-300 underline">
            Overview
          </Link>
          .
        </p>
      </div>

      <PublishHiddenCard />

      <BlocklistCard />

      <Link
        href="/shop/dashboard/tools/revenue"
        className="block rounded-xl border border-purple-400/25 bg-gradient-to-r from-purple-500/10 to-blue-500/5 p-4 transition hover:border-purple-400/45"
      >
        <p className="text-sm font-semibold text-purple-200">
          📒 Revenue Import — drop your weekly Numbers/Excel workbook
        </p>
        <p className="mt-1 text-xs text-white/50">
          Multi-tab parser for Flips, Table Rentals, Extra Extra!, Cards for
          Flip, etc. Re-uploads update existing rows, no duplicates.
        </p>
      </Link>

      {/* Quick links — listing creation flows */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/shop/new"
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-purple-400/40 hover:bg-white/[0.06]"
        >
          <p className="text-sm font-semibold text-white">📸 New listing (mobile, AI-assisted)</p>
          <p className="mt-1 text-xs text-white/40">
            Snap photos → AI title/description/category → save as draft.
          </p>
        </Link>

        <Link
          href="/shop/admin/amazon-batch"
          className="rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-orange-500/10 p-4 transition hover:border-amber-400/50"
        >
          <p className="text-sm font-semibold text-amber-200">🛒 Amazon Batch — populate Idea Lists</p>
          <p className="mt-1 text-xs text-white/50">
            SPACE = open Amazon, paste SiteStripe link anywhere → auto-saves &amp; advances.
          </p>
        </Link>
      </div>

      {/* Platform connections */}
      <div className="grid gap-3 sm:grid-cols-2">
        <EbayConnectionCard />
        <FbBackfillCard />
      </div>
    </div>
  );
}
