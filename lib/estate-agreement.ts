/**
 * Tolley Estate Sales — the fill-in-the-blank client agreement.
 *
 * DRAFT v1.0 (2026-07-19): drafted from the published plain-English terms and
 * sale #1 practice. Pending Jared's line-by-line confirmation against the
 * signed sale-1 contract; not reviewed by an attorney. The signed paper copy
 * is always the binding document — this page exists so clients can read and
 * print the real thing before anyone visits.
 */

export const AGREEMENT_VERSION = "1.0 — draft";

/** Fill-in fields in the header block. `wide` fields take a full row. */
export interface AgreementField {
  label: string;
  hint?: string;
  wide?: boolean;
}

export const AGREEMENT_FIELDS: AgreementField[] = [
  { label: "Client name", hint: "person signing for the family or estate" },
  { label: "Client phone / email" },
  {
    label: "Sale conducted on behalf of (owner or estate of record)",
    hint: "the sale is run in this name — see Taxes, clause 8",
    wide: true,
  },
  { label: "Property address", wide: true },
  { label: "Sale dates", hint: "up to 3 consecutive days" },
  { label: "Doors open / close", hint: "e.g. 8:00 am – 4:00 pm" },
  { label: "Staging begins" },
  { label: "Commission", hint: "% of gross sale proceeds" },
  { label: "Settlement due", hint: "business days after the sale ends" },
];

export interface AgreementClause {
  title: string;
  body: string;
  /** Optional pick-one election rendered as checkboxes. */
  options?: string[];
}

export const AGREEMENT_CLAUSES: AgreementClause[] = [
  {
    title: "Services",
    body: "Tolley Estate Sales (operated by Your KC Homes LLC, Independence, MO — “the Company”) will act as the Client's agent to stage, research, price, photograph, advertise, staff, and conduct an estate sale of the personal property the Client designates at the Property, on the dates above. The sale is conducted in the name of and on behalf of the owner or estate named above.",
  },
  {
    title: "Compensation",
    body: "The Client pays nothing up front. The Company earns the Commission stated above, calculated on gross sale proceeds. The Commission covers staging, pricing research, photography, advertising, sale staffing, and payment processing. Add-on services (haul-away, cleanout, dumpster) are itemized and agreed in writing before they happen.",
  },
  {
    title: "Pricing & reserves",
    body: "The Company prices items against real sold comparables. Minimum prices (reserves) for specific items must be listed in Appendix A before staging begins; items without a reserve may be sold at the Company's discretion, including discounting and lotting to sell the home down.",
  },
  {
    title: "Payment forms at the sale",
    body: "The sale accepts every common form of payment — cash, all major credit and debit cards, tap-to-pay, and approved payment apps. Payment processing costs are the Company's responsibility, covered by the Commission.",
  },
  {
    title: "Inventory stays once staging begins",
    body: "Before staging begins, the family removes everything it wishes to keep — the Company will walk the home with the Client to confirm. After staging begins, items may not be withdrawn from the sale. Items withdrawn anyway are valued at their tag price and that amount is added to gross proceeds for Commission purposes.",
  },
  {
    title: "Unsold items",
    body: "Items unsold when the sale ends are handled as elected below (one choice, made at signing):",
    options: [
      "(a) Returned to the Client as-is.",
      "(b) Donated, with receipts collected and delivered to the Client.",
      "(c) Hauled away for the fee agreed in writing.",
      "(d) Consigned into the Company's resale channels — the Company keeps selling them for the Client online, remitting the agreed share as items sell.",
    ],
  },
  {
    title: "Settlement",
    body: "The Company delivers an itemized settlement statement and full payment of the Client's share within the number of business days stated above, counted from the last sale day.",
  },
  {
    title: "Taxes",
    body: "The sale is conducted on behalf of the owner or estate named above as a liquidation of household personal property under Missouri law (RSMo 144.010). The Company is not a tax advisor; the Client is encouraged to consult a tax professional.",
  },
  {
    title: "Access, utilities & care of the home",
    body: "The Client provides reasonable access on staging and sale days with electricity and water on. The Company manages sale-day traffic with staffed entrances and occupancy limits and conducts the sale with reasonable care for the home.",
  },
  {
    title: "Cancellation",
    body: "Either party may cancel in writing before staging begins at no cost. After staging or advertising has begun, the Client owes a cancellation fee equal to the Company's documented work performed and out-of-pocket advertising costs.",
  },
  {
    title: "Entire agreement",
    body: "This document (with Appendix A, reserves) is the entire agreement, governed by Missouri law. Changes are valid only in writing signed by both parties.",
  },
];

export const AGREEMENT_SIGNATURES = [
  { label: "Client signature", date: true },
  { label: "For Tolley Estate Sales / Your KC Homes LLC", date: true },
] as const;
