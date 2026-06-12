/**
 * lib/leads/owner-info.ts
 *
 * Shared owner-contact extraction for dossier results. Moved verbatim from
 * app/api/cron/leads-monday-digest/route.ts so the seller-seed pipeline and
 * the Monday digest read DossierResult.owners identically.
 */

export interface OwnerInfo {
  name: string | null;
  phone: string | null;
  email: string | null;
  age: string | null;
  mailingAddress: string | null;
}

export function pickOwnerInfo(owners: unknown): OwnerInfo {
  const empty: OwnerInfo = { name: null, phone: null, email: null, age: null, mailingAddress: null };
  if (!owners || typeof owners !== "object") return empty;

  // Accept these shapes (research worker emits any of them):
  //   { name, phone, email, age, mailingAddress, ... }
  //   { primary: { name, phone, ... }, ... }
  //   [{ name, phone, ... }, ...]
  const candidate = (() => {
    if (Array.isArray(owners) && owners.length > 0) return owners[0] as Record<string, unknown>;
    const o = owners as Record<string, unknown>;
    if (typeof o.name === "string") return o;
    const primary = o.primary as Record<string, unknown> | undefined;
    if (primary && typeof primary === "object") return primary;
    return null;
  })();

  if (!candidate) return empty;

  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

  // Stale demo placeholders survive in the DB because pipeline.ts writes
  // owners:undefined when CBC finds nothing. Treat them as no-data.
  const rawName = str(candidate.name);
  const looksLikePlaceholder =
    rawName != null && /^\[demo|see full dossier|verify in/i.test(rawName);
  return {
    name: looksLikePlaceholder ? null : rawName,
    phone: str(candidate.phone),
    email: str(candidate.email),
    age: str(candidate.age) ?? (typeof candidate.age === "number" ? String(candidate.age) : null),
    mailingAddress: str(candidate.mailingAddress),
  };
}
