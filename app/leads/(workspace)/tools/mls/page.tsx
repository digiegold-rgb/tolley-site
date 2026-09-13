import Link from "next/link";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";
import { prisma } from "@/lib/prisma";
import { mlsObservationIsStale, privateMlsResearchSchema } from "@/lib/leads/mls-research";

export const dynamic = "force-dynamic";
export default async function MlsToolsPage() {
  const session = await requireOwnerTool("/leads/tools/mls");
  const sub = await prisma.leadSubscriber.findUnique({where:{userId:session.user!.id!}});
  const [receipt,rows] = sub ? await Promise.all([
    prisma.crmActivity.findUnique({where:{id:`mls-sweep:${sub.id}`}}),
    prisma.crmActivity.findMany({where:{subscriberId:sub.id,type:"mls_capture"},orderBy:{createdAt:"desc"},take:100}),
  ]) : [null,[]];
  const report = receipt?.metadata as {runId?:string;status?:string;message?:string;observedAt?:string} | null;
  return <div className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-sm text-teal-200">Owner research</p><h1 className="mt-2 text-3xl font-semibold">Live MLS research</h1><p className="mt-3 text-white/65">Spark searches your signed-in Remine account each weekday before the 8am desk drop. Verified property captures remain private to this workspace. No messages are sent.</p></header>
    <section className="rounded-xl border border-white/15 p-5"><h2 className="font-semibold">{report?.status?.replaceAll("_"," ") || "Awaiting first sweep"}</h2><p className="mt-2 text-white/65">{report?.message || "The browser worker has not reported a sweep yet."}</p>{report?.observedAt && <p className="mt-2 text-sm text-white/50">Last observed: {new Date(report.observedAt).toLocaleString("en-US",{timeZone:"America/Chicago"})} CT{mlsObservationIsStale(report.observedAt) ? " · Stale; a fresh sweep is needed." : ""}</p>}</section>
    <p className="text-sm text-white/60">An expired login or verification challenge pauses collection. Sign into Heartland in the research browser on Spark, then the next scheduled attempt can resume.</p>
    <div className="grid gap-4 sm:grid-cols-2">{rows.flatMap(row=>{const p=privateMlsResearchSchema.safeParse(row.metadata);return p.success ? [<Link key={row.id} href={`/leads/mls/${encodeURIComponent(row.id)}`} className="rounded-xl border border-white/10 p-5"><h2 className="font-semibold">{p.data.capture.address}</h2><p className="mt-2 text-sm text-white/60">{p.data.capture.city} · {p.data.capture.status} · {p.data.score}/100</p><p className="mt-2 text-xs text-white/50">Observed {new Date(p.data.capture.observedAt).toLocaleString("en-US",{timeZone:"America/Chicago"})} CT{report?.status !== "ready" || report.runId !== p.data.runId || mlsObservationIsStale(p.data.capture.observedAt) ? " · Previous observation; requires a fresh sweep" : ""}</p></Link>] : [];})}</div>
    <Link href="/leads" className="block text-teal-200 underline">Open Today drafts</Link>
  </div>;
}
