import { requireAdminPageSession } from "@/lib/admin-auth";
import GodModeDashboard from "@/components/trading/GodModeDashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GodModePage() {
  await requireAdminPageSession("/trading/god-mode");

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/trading"
            className="text-xs text-white/20 hover:text-amber-400/60 transition-colors"
          >
            &larr; Dashboard
          </Link>
          <Link
            href="/trading/simulations"
            className="text-xs text-white/20 hover:text-amber-400/60 transition-colors"
          >
            Simulations
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-purple-400/60 font-mono uppercase tracking-widest">
            God Mode
          </span>
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
        </div>
      </div>
      <GodModeDashboard />
    </div>
  );
}
