import { requireAdminPageSession } from "@/lib/admin-auth";
import { CreditDashboard } from "@/components/credit/CreditDashboard";

export const dynamic = "force-dynamic";

const LEDGER_URL = process.env.LEDGER_URL || "http://localhost:8920";
const LEDGER_TOKEN = process.env.LEDGER_BEARER_TOKEN || "";

async function fetchDashboard() {
  try {
    const res = await fetch(`${LEDGER_URL}/credit/dashboard`, {
      headers: { Authorization: `Bearer ${LEDGER_TOKEN}` },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function CreditPage() {
  const session = await requireAdminPageSession("/credit");
  const dashboard = await fetchDashboard();

  const latest = dashboard?.scores?.latest;
  const bestScore = latest
    ? Math.max(
        latest.transunion || 0,
        latest.equifax || 0,
        latest.experian || 0
      )
    : 0;
  const needPts = bestScore > 0 ? Math.max(0, 680 - bestScore) : 48;

  return (
    <>
      <header className="relative mb-6 overflow-hidden rounded-3xl border border-[#00d4ff]/20 bg-[#0d1117] shadow-[0_0_40px_rgba(0,212,255,0.08)]">
        {/* Decorative gradient streak */}
        <div className="absolute -right-20 -top-20 h-40 w-80 rotate-12 rounded-full bg-gradient-to-r from-cyan-500/10 via-blue-500/5 to-transparent blur-3xl" />
        <div className="absolute -left-10 bottom-0 h-24 w-60 rounded-full bg-gradient-to-r from-amber-500/8 to-transparent blur-2xl" />

        <div className="relative flex items-center justify-between p-7">
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-[#00d4ff] via-[#00b4d8] to-[#0077b6] bg-clip-text text-transparent">
                CREDIT RECOVERY
              </span>
              <span className="ml-3 text-white/90">ROADMAP</span>
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Cordless (Tolley) | March 2026 | Goal: HELOC Approval at 680+
            </p>
            {needPts > 0 ? (
              <p className="mt-1">
                <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-bold text-amber-400">
                  Need +{needPts} pts to HELOC
                </span>
              </p>
            ) : (
              <p className="mt-1">
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-sm font-bold text-green-400">
                  HELOC ELIGIBLE
                </span>
              </p>
            )}
          </div>
          <div className="hidden space-y-2 text-right sm:block">
            <div className="rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-5 py-3">
              <p className="text-3xl font-black text-[#00d4ff]">$128K</p>
              <p className="text-[0.6rem] tracking-wider text-white/40 uppercase">
                Home Equity
              </p>
            </div>
            <p className="text-[0.6rem] text-white/30">
              11913 Mar Bec Trl, Independence MO
            </p>
          </div>
        </div>
      </header>

      <CreditDashboard initialData={dashboard} />
    </>
  );
}
