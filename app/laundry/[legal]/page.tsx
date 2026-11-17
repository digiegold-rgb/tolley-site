import { notFound } from "next/navigation";
import { legalPages } from "@/lib/laundry/legal";
export function generateStaticParams() {
  return Object.keys(legalPages).map((legal) => ({ legal }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ legal: string }>;
}) {
  const { legal } = await params;
  return {
    title: legalPages[legal as keyof typeof legalPages]?.title || "Not found",
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ legal: string }>;
}) {
  const { legal } = await params,
    p = legalPages[legal as keyof typeof legalPages];
  if (!p) notFound();
  return (
    <article className="wrap page legal">
      <p className="eyebrow">Effective November 16, 2026</p>
      <h1>{p.title}</h1>
      {p.sections.map(([title, body]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}
    </article>
  );
}
