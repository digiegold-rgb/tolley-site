import { notFound } from "next/navigation";
import { BASE } from "@/lib/laundry/config";
import { publicOperators } from "@/lib/laundry/store";
import { OperatorCard } from "@/components/laundry/operator-card";
import { coveredCities } from "@/lib/laundry/cities";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    c = (await coveredCities()).find((c) => c.slug === slug);
  return {
    title: c
      ? `Washer and dryer rental in ${c.name}, ${c.state}`
      : "City not found",
    alternates: { canonical: `${BASE}/laundry/cities/${slug}` },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    c = (await coveredCities()).find((c) => c.slug === slug);
  if (!c) notFound();
  const ops = await publicOperators(c.zip);
  return (
    <div className="wrap page">
      <p className="eyebrow">Local rental directory · {c.state}</p>
      <h1>Washer and dryer rental in {c.name}.</h1>
      <p>{c.detail}</p>
      <form className="search" action="/laundry#find">
        <label className="sr-only" htmlFor="zip">
          Your exact delivery ZIP
        </label>
        <input
          id="zip"
          name="q"
          placeholder="Your exact delivery ZIP"
          pattern="[0-9]{5}"
          maxLength={5}
          required
        />
        <button>Check coverage</button>
      </form>
      <div className="grid two">
        {ops.map((op) => (
          <OperatorCard op={op} zip={c.zip} key={op.id} />
        ))}
      </div>
      {!ops.length && (
        <p>
          No operator currently accepts requests here. Search your ZIP to check
          nearby coverage.
        </p>
      )}
    </div>
  );
}
