import { z } from "zod";

export const MAX_UPLOAD = 2_000_000;
export const money = z.number().int().min(0).max(100_000_000);
const optionalMoney = money.nullable().default(null);
export function sourceUrl(value: string): string {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password)
    throw new Error("Use a public HTTPS listing URL");
  if (
    u.hostname === "localhost" ||
    /^\d+(\.\d+){3}$/.test(u.hostname) ||
    u.hostname.includes(":")
  )
    throw new Error("Use a public listing URL");
  u.hash = "";
  if (u.hostname === "www.bstock.com") u.hostname = "bstock.com";
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  for (const key of [...u.searchParams.keys()])
    if (/^(utm_|fbclid|gclid)/i.test(key)) u.searchParams.delete(key);
  return u.toString();
}
export const opportunityInput = z.object({
  sourceUrl: z.string().max(2000).transform(sourceUrl),
  supplier: z.string().trim().min(1).max(150),
  title: z.string().trim().min(1).max(500),
  category: z.string().max(100).default("Mixed"),
  condition: z.string().max(150).default("Unknown"),
  location: z.string().max(200).nullable().default(null),
  distanceMiles: z.number().min(0).max(20000).nullable().default(null),
  pickup: z.boolean().nullable().default(null),
  parcel: z.boolean().default(false),
  quantity: z.number().int().min(1).max(1000000).nullable().default(null),
  bidCents: optionalMoney,
  feesCents: optionalMoney,
  freightCents: optionalMoney,
  resaleCents: optionalMoney,
  resaleEvidence: z.string().max(2000).nullable().default(null),
  endsAt: z.string().datetime().nullable().default(null),
  observedAt: z.string().datetime().optional(),
  historical: z.boolean().default(false),
  watched: z.boolean().default(false),
  notes: z.string().max(5000).nullable().default(null),
});
export const manifestRow = z.object({
  title: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(1).max(100000),
  sku: z.string().max(150).default(""),
  retailCents: optionalMoney,
});
export const receiptRow = z
  .object({
    title: z.string().trim().min(1).max(500),
    category: z.string().max(100).default("Mixed"),
    condition: z.string().max(150).default("Inspected"),
    expected: z.number().int().min(0).max(100000),
    good: z.number().int().min(0).max(500),
    damaged: z.number().int().min(0).max(100000),
    allocationCents: money.optional(),
  })
  .refine(
    (r) => r.good + r.damaged <= r.expected,
    "Received units exceed expected units; update expected first",
  );
export const receiptInput = z.array(receiptRow).min(1).max(500);
export type ReceiptRow = z.infer<typeof receiptRow>;

export function landedCost(d: {
  bidCents: number | null;
  feesCents: number | null;
  freightCents: number | null;
}) {
  return d.bidCents === null || d.feesCents === null || d.freightCents === null
    ? null
    : d.bidCents + d.feesCents + d.freightCents;
}
export function allocateReceipt(rows: ReceiptRow[], total: number) {
  const count = rows.reduce((s, r) => s + r.good + r.damaged, 0);
  if (!count) throw new Error("Receive at least one unit before finalizing");
  if (rows.reduce((s, r) => s + r.good, 0) > 500)
    throw new Error("Finalize up to 500 sellable units per trial lot");
  const custom = rows.some((r) => r.allocationCents !== undefined);
  if (
    custom &&
    (rows.some((r) => r.allocationCents === undefined) ||
      rows.reduce((s, r) => s + (r.allocationCents ?? 0), 0) !== total)
  )
    throw new Error(
      "Every row allocation is required and must add up to the purchase total",
    );
  let offset = 0;
  return rows.map((r) => {
    const n = r.good + r.damaged;
    const amount = custom
      ? r.allocationCents!
      : Math.floor(total / count) * n +
        Math.max(0, Math.min(n, (total % count) - offset));
    offset += n;
    if (!n && amount)
      throw new Error("Missing units cannot receive cost allocation");
    const unitCosts = Array.from(
      { length: r.good },
      (_, i) => Math.floor(amount / n) + (i < amount % n ? 1 : 0),
    );
    return {
      ...r,
      allocationCents: amount,
      unitCosts,
      writeoffCents: amount - unitCosts.reduce((s, v) => s + v, 0),
    };
  });
}
export function dealState(
  d: {
    historical: boolean;
    observedAt: Date | string;
    endsAt: Date | string | null;
  },
  now = Date.now(),
) {
  if (d.historical) return "Historical";
  if (d.endsAt && new Date(d.endsAt).getTime() <= now) return "Ended";
  return now - new Date(d.observedAt).getTime() > 24 * 3600_000
    ? "Needs refresh"
    : "Recent observation";
}
export const SOURCES = [
  {
    name: "B-Stock",
    url: "https://bstock.com/all-auctions",
    note: "Saved search emails and manifests. Freight and pickup eligibility vary by seller.",
  },
  {
    name: "Equip-Bid",
    url: "https://www.equip-bid.com/",
    note: "KC local auctions. Check inspection, buyer premium, and pickup deadline on each lot.",
  },
  {
    name: "Cargo Largo",
    url: "https://www.cargolargo.com/bid-sale",
    note: "Independence bid sale; email list and in-person inspection. Verify current hours before travel.",
  },
  {
    name: "Direct Liquidation",
    url: "https://www.directliquidation.com/",
    note: "Compare small lots only after freight and condition are known.",
  },
];
