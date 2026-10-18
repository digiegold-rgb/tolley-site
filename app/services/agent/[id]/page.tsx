import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { executeRecipe } from "@/lib/company/growth";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await prisma.companyCapability.findUnique({ where: { id } });
  if (!row || row.status !== "published") return { robots: { index: false } };
  const manifest = row.manifest as { title: string; description: string };
  return { title: manifest.title, description: manifest.description, alternates: { canonical: `https://www.tolley.io/services/agent/${encodeURIComponent(id)}` } };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const row = await prisma.companyCapability.findUnique({ where: { id } });
  if (!row || row.status !== "published") notFound();
  const result = await executeRecipe(id, {});
  return <main className="mx-auto max-w-4xl space-y-8 p-8"><Link href="/services/agent">← Agent services</Link><h1 className="text-3xl font-semibold">{(row.manifest as { title: string }).title}</h1>{result.guide.map((g, i) => g && <section key={i} className="space-y-4 rounded-xl border p-6"><h2 className="text-2xl">{g.title}</h2><p>{g.description}</p>{g.questions.map((q,j) => <div key={j}><h3 className="font-semibold">{q.q}</h3><p>{q.a}</p></div>)}<a href={g.url} className="underline">Current service details</a></section>)}<p>{result.next}</p></main>;
}
