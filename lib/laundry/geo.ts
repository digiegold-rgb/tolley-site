import raw from "@/data/laundry/us-zips.json";
const places = raw as unknown as Record<
  string,
  [string, string, number, number]
>;
export function zipPlace(zip: string) {
  const p = places[zip];
  return p ? { zip, city: p[0], state: p[1], lat: p[2], lng: p[3] } : null;
}
export function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const r = Math.PI / 180,
    dlat = (b.lat - a.lat) * r,
    dlng = (b.lng - a.lng) * r;
  return (
    3958.8 *
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dlng / 2) ** 2,
      ),
    )
  );
}
export function covers(
  op: { zips: string[]; zip: string; radiusMiles: number },
  zip: string,
) {
  if (op.zips.length) return op.zips.includes(zip);
  const a = zipPlace(op.zip),
    b = zipPlace(zip);
  return !!a && !!b && milesBetween(a, b) <= op.radiusMiles;
}
export function searchPlaces(query: string) {
  const q = query.trim().toLowerCase().replace(/,/g, "");
  if (/^\d{5}$/.test(q)) {
    const p = zipPlace(q);
    return p ? [p] : [];
  }
  if (q.length < 2) return [];
  return Object.keys(places)
    .filter((z) => {
      const p = places[z];
      return `${p[0]} ${p[1]}`.toLowerCase() === q || p[0].toLowerCase() === q;
    })
    .map((z) => zipPlace(z)!);
}
export function allZipPlaces() {
  return Object.keys(places).map((z) => zipPlace(z)!);
}
