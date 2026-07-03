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
        <DossierPanel {...stubData} />
      </div>
    </main>
  );
}
