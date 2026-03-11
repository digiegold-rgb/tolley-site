import { redirect } from "next/navigation";
import DossierView from "@/components/leads/DossierView";

export const revalidate = 10;

export default async function DossierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  if (key !== process.env.SYNC_SECRET) redirect("/leads");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/leads/dossier/${id}`, {
    headers: { "x-sync-secret": process.env.SYNC_SECRET! },
    cache: "no-store",
  });

  if (!res.ok) redirect(`/leads/dossier?key=${key}`);
  const data = await res.json();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Back link */}
        <a
          href={`/leads/dossier?key=${key}`}
          className="text-sm text-blue-400 hover:underline mb-4 inline-block"
        >
          &larr; Back to dossiers
        </a>

        <DossierView job={data.job} syncKey={key || ""} />
      </div>
    </div>
  );
}
