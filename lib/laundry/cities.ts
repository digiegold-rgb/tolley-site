import { prisma } from "@/lib/prisma";
import { CITIES } from "./config";
import { allZipPlaces, covers, zipPlace } from "./geo";
export async function coveredCities() {
  const ops = await prisma.laundryOperator.findMany({
    where: { status: "approved" },
    select: { zip: true, zips: true, radiusMiles: true },
  });
  const candidates = ops.some((o) => !o.zips.length)
    ? allZipPlaces()
    : ops.flatMap((o) => o.zips.map(zipPlace).filter((p) => p !== null));
  const map = new Map<
    string,
    { slug: string; name: string; state: string; zip: string; detail: string }
  >();
  for (const p of candidates) {
    if (!ops.some((o) => covers(o, p.zip))) continue;
    const slug = `${p.city}-${p.state}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    const curated = CITIES.find((c) => c.slug === slug);
    if (!map.has(slug))
      map.set(
        slug,
        curated || {
          slug,
          name: p.city,
          state: p.state,
          zip: p.zip,
          detail: `Compare approved operators serving ${p.city}, ${p.state}. Check your exact ZIP and review each operator’s equipment, prices, delivery fee and rental agreement before requesting a day.`,
        },
      );
  }
  return [...map.values()];
}
