import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";
import { prisma } from "@/lib/prisma";
import { privateMlsResearchSchema } from "@/lib/leads/mls-research";

export const dynamic = "force-dynamic";
export default async function MlsResearchPage({params}:{params:Promise<{id:string}>}) {
  const {id} = await params;
  const session = await requireOwnerTool(`/leads/mls/${encodeURIComponent(id)}`);
  const sub = await prisma.leadSubscriber.findUnique({where:{userId:session.user!.id!}});
  if (!sub || sub.status !== "active") notFound();
  const row = await prisma.crmActivity.findFirst({where:{id,subscriberId:sub.id,type:"mls_capture"}});
  const parsed = privateMlsResearchSchema.safeParse(row?.metadata);
  if (!parsed.success) notFound();
  const {capture:c,score,reasons} = parsed.data;
  return <article className="mx-auto max-w-4xl space-y-6">
    <Link href="/leads" className="text-teal-200 underline">Back to Today</Link>
    <header><p className="text-sm text-teal-200">Private MLS research · {score}/100</p><h1 className="mt-2 text-3xl font-semibold">{c.address}</h1><p>{c.city}, {c.state} {c.zip}</p></header>
    <p className="text-sm text-white/65">Observed {new Date(c.observedAt).toLocaleString("en-US",{timeZone:"America/Chicago"})} CT through your signed-in {c.plan}. This dossier contains MLS evidence only; ownership, court records, and contact permissions require separate verification. The score ranks research priorities, not verified seller intent.</p>
    <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-teal-200 underline">Open Remine · search MLS #{c.mlsNumber}</a>
    <dl className="grid gap-4 sm:grid-cols-2">{Object.entries({Status:c.status,"List price":c.listPrice,"Original list price":c.originalListPrice,"Days on market":c.daysOnMarket,Beds:c.beds,Baths:c.baths,"Square feet":c.sqft,"Estimated value":c.estimatedValue,Equity:c.equity,"Sell score":c.sellScore,"Ownership years":c.ownershipYears,"Owner shown":c.ownerName}).map(([label,value])=><div key={label} className="rounded-xl border border-white/10 p-4"><dt className="text-sm text-white/55">{label}</dt><dd className="mt-1">{value ?? "Not available in this capture"}</dd></div>)}</dl>
    <section><h2 className="text-xl font-semibold">Why it scored</h2><ul className="mt-3 list-inside list-disc text-white/70">{reasons.map(r=><li key={r}>{r}</li>)}</ul></section>
    <details className="rounded-xl border border-white/10 p-5"><summary className="cursor-pointer">Captured property evidence</summary><p className="mt-4 whitespace-pre-wrap text-sm text-white/70">{c.detailText}</p></details>
  </article>;
}
