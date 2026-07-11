import { DossierPanel } from "@/components/portal/dossier-panel";
import { buildStubDossier } from "@/lib/dossier/stub";

export const dynamic = "force-dynamic";

// TODO: wire to real /api/leads/* when schema lands. Today this is a deterministic
// stub keyed off the address slug so design QA reflects stable, plausible data.

export default async function DossierByAddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const resolved = await params;
  const rawAddress = decodeURIComponent(resolved.address || "");
  const stubData = buildStubDossier(rawAddress);

  return (
    <main className="portal-shell ambient-noise relative min-h-screen w-full overflow-hidden bg-[#06050a]">
      <div
        aria-hidden="true"
        className="portal-spotlight portal-spotlight-left"
      />
      <div
        aria-hidden="true"
        className="portal-spotlight portal-spotlight-right"
      />
      <div className="relative z-20 w-full">
        {/* This route renders generated sample data (lib/dossier/stub.ts) —
            say so, loudly, until the real data pipeline lands. */}
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
            <strong>Demo preview.</strong> The figures below are generated
            sample data, not real property records. Want the real dossier for
            this address?{" "}
            <a href="/leads" className="underline hover:text-amber-100">
              Talk to T-Agent →
            </a>
          </div>
        </div>
        <DossierPanel {...stubData} />
      </div>
    </main>
  );
}
