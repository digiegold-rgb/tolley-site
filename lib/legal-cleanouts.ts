/**
 * Your KC Homes LLC cleanout legal copy and payment-page copy.
 *
 * Terms, privacy, and the public payment page all render from this file.
 * The cleanout invoice preset uses the same deposit rule and the same terms URL.
 */

export const CK_ENTITY = "Your KC Homes LLC";
export const CK_ADDRESS = "Independence, Missouri";
export const CK_EMAIL = "jared@yourkchomes.com";
export const CK_PHONE = "913-283-3826";
export const CK_PHONE_TEL = "tel:+19132833826";
export const CK_PHONE_SMS = "sms:+19132833826";
export const CK_CONTACT_NAME = "Jared Tolley";
export const CK_EFFECTIVE_DATE = "October 13, 2026";
export const CK_LAST_UPDATED = "October 13, 2026";
export const CK_TERMS_URL = "https://tolley.io/cleanouts/terms";
export const CK_TERMS_PATH = "/cleanouts/terms";
export const CK_PRIVACY_PATH = "/cleanouts/privacy";
export const CK_PAYMENT_PATH = "/cleanouts/payment";

export const CK_TERMS_TITLE = "Terms of Service";
export const CK_PRIVACY_TITLE = "Privacy Policy";
export const CK_TERMS_DESCRIPTION =
  "Terms of Service for cleanout, haul-away, and turnover jobs booked with Your KC Homes LLC.";
export const CK_PRIVACY_DESCRIPTION =
  "How Your KC Homes LLC collects, uses, and shares information for cleanout jobs booked at tolley.io/cleanouts.";

export const CLEANOUT_REFERENCE = "CLEANOUT";
export const CLEANOUT_DEPOSIT_THRESHOLD = 1000;
export const CLEANOUT_DEPOSIT_RATE = 0.25;
export const CLEANOUT_DEPOSIT_DESCRIPTION = "Deposit due now (25%)";
export const CLEANOUT_BALANCE_DESCRIPTION =
  "Balance due when the job is complete (not charged on this invoice)";

export const CLEANOUT_INVOICE_NOTE = [
  `Terms of Service: ${CK_TERMS_URL}`,
  "Jobs over $1,000 include a 25% deposit due now. The balance is due when the job is complete. Cash and check have no added fee.",
].join("\n");

export const CLEANOUT_DEPOSIT_HINT =
  "Jobs over $1,000 add a 25% deposit line. The invoice total is that deposit. The job price stays on the invoice, and the balance is due when the job is complete.";

export const TERMS_ACCEPTED_MARKER = `Agreed to the cleanout terms at ${CK_TERMS_URL}`;
export const CASH_NOTE_MARKER = "Customer will pay by cash or check. No card or bank fee.";

export const CK_VENMO_HANDLE = "Jared-Tolley";
export const CK_VENMO_PHONE = "215-300-4488";

/** Venmo pay deep link. Amount comes from the invoice, never the customer. */
export function venmoPayUrl(amount: number, invoiceNumber: string): string {
  const params = new URLSearchParams({
    txn: "pay",
    amount: amount.toFixed(2),
    note: `Cleanout ${invoiceNumber}`,
  });
  return `https://venmo.com/u/${CK_VENMO_HANDLE}?${params.toString()}`;
}

export const PAYMENT_COPY = {
  kicker: "Payment",
  title: "Pay your cleanout invoice",
  description: "Pay a Your KC Homes LLC cleanout invoice by card, bank, cash, or check.",
  intro:
    "Enter the invoice number from your text or email. You never enter an amount — the invoice already has the price.",
  invoiceLabel: "Invoice number",
  invoicePlaceholder: "INV-0147",
  lookupButton: "Look up invoice",
  invalidNumber: "Enter the full invoice number, like INV-0147.",
  notFound: "We couldn't find that invoice. Check the number, or call us and we'll pull it up.",
  rateLimited: "Too many lookups from this network. Wait a few minutes and try again, or call us.",
  termsBefore: "I agree to the",
  termsLink: "Terms of Service",
  termsAfter: "for Your KC Homes LLC cleanouts.",
  cardButton: "Pay by card or bank",
  cashButton: "I'll pay cash or check",
  cashNote:
    "Cash and check have no added fee. We only add a note on the invoice — nothing is charged online.",
  venmoButton: "Pay with Venmo",
  venmoNote: "Venmo @Jared-Tolley (or phone 215-300-4488). Put your invoice number in the note.",
  cashThanks:
    "Thanks. We noted that you'll pay by cash or check, and there is no online fee. We'll confirm with you.",
  paidTitle: "This invoice is already paid.",
  amountDueLabel: "Amount due",
  depositNote: "Jobs over $1,000 include a 25% deposit. Pay the amount due shown here.",
  consignmentNote:
    "Consignment, when we agree to it in writing: 50% if we haul the item, 30% if you keep it, negotiable. Unsold items are handled within 30 days.",
  callPrompt: "Questions? Call or text",
  termsRequired: "Check the box to agree to the terms before you pay.",
  unavailable: "That invoice can't be paid here. Call us and we'll help.",
  originError: "Open the payment page and submit the form from there.",
  choiceInvalid: "Choose card, bank, cash, or check.",
  amountRejected: "The amount comes from the invoice. You can't enter one here.",
} as const;

export type LegalItem = {
  text: string;
  items?: LegalItem[];
};

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: LegalItem[];
};

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: "1. Who these terms cover",
    paragraphs: [
      `These terms cover your use of tolley.io/cleanouts and any cleanout, haul-away, or turnover job you book with ${CK_ENTITY} ("we," "us"). If we both sign a written job quote or agreement, that document controls where it conflicts with these terms.`,
    ],
  },
  {
    heading: "2. Your quote is your price",
    items: [
      {
        text: "We give you one flat price for the whole job, based on photos or a free walkthrough.",
      },
      {
        text: "The price you approve is the price you pay. There are no surprise charges, no hourly meter, and no add-on dump or fuel fees after the fact.",
      },
      {
        text: "The price changes only if the job itself changes: for example, you add rooms or items that weren't shown, or hazardous materials turn up (see Section 6). We will tell you about any change and get your OK before we do the extra work.",
      },
    ],
  },
  {
    heading: "3. Cleaning is included",
    paragraphs: [
      "Every quote includes a broom-clean finish: we sweep the floors and remove debris, and the space is left ready for paint, carpet, a showing, or keys. Deep cleaning (scrubbing, carpet shampoo) is quoted separately only if you ask for it.",
    ],
  },
  {
    heading: "4. Fast in-and-out",
    paragraphs: [
      "Most jobs are finished in a single visit. We arrive at the scheduled time, clear the space, haul everything away, and send before and after photos. You don't need to be there; a lockbox code, a key, or a property manager is enough.",
    ],
  },
  {
    heading: "5. Items of value: consignment",
    items: [
      {
        text: "If you point out an item you believe has value, we can try to sell it for you on consignment instead of hauling it off as junk.",
      },
      {
        text: "The consignment fee is negotiable. Our standard rates are:",
        items: [
          {
            text: "**50% of the sale price** if we haul the item away, store it, and sell it.",
          },
          {
            text: "**30% of the sale price** if you keep the item and we list and sell it from your location.",
          },
        ],
      },
      {
        text: "We'll put the agreed rate in writing before the job.",
      },
      {
        text: "We sell in good faith but don't guarantee any sale price or a sale at all. If an item has not sold within 30 days, we return it to you, donate it, or dispose of it, whichever you choose.",
      },
      {
        text: "Separately from consignment, any resale value we identify while quoting can be credited against your price before you approve it.",
      },
    ],
  },
  {
    heading: "6. What we don't take",
    paragraphs: [
      "We don't haul hazardous materials (paint, chemicals, fuel, asbestos, medical waste, ammunition, or firearms). If we find any, we'll set them aside and tell you where to dispose of them properly.",
    ],
  },
  {
    heading: "7. Payment",
    items: [
      {
        text: "Payment is due when the job is complete unless we agree to something else in writing. Jobs over $1,000 require a 25% deposit.",
      },
      {
        text: "You can pay by card or bank transfer (ACH) through our secure Stripe payment link, or by **cash or check with no added fee**.",
      },
      {
        text: "Card payments are processed by Stripe. We never see or store your full card number.",
      },
      {
        text: "If you have a concern about the work, tell us within 48 hours and we'll come back and make it right.",
      },
    ],
  },
  {
    heading: "8. Ownership and permission",
    paragraphs: [
      "By booking a job, you confirm that you own the items and the property, or are authorized to have them removed (for example as executor, landlord, or property manager). Anything we remove becomes ours to donate, recycle, dispose of, or resell, except consignment items under Section 5.",
    ],
  },
  {
    heading: "9. Scheduling and cancellation",
    paragraphs: [
      "You can reschedule or cancel up to 24 hours before the job. If you cancel later than that, or we arrive and can't get in, call us and we'll reschedule.",
    ],
  },
  {
    heading: "10. Liability",
    paragraphs: [
      "We take care in your property. If we damage something through our own negligence, we'll repair it or pay for it. To the fullest extent Missouri law allows, our total liability is limited to the amount you paid for the job, and we are not liable for indirect or consequential damages. We are not responsible for items left in the space that you didn't tell us to keep.",
    ],
  },
  {
    heading: "11. Website use",
    paragraphs: [
      "The content on this site belongs to us. Don't scrape the site or republish its content commercially. We may change the site at any time.",
    ],
  },
  {
    heading: "12. Governing law",
    paragraphs: [
      "Missouri law governs these terms. Disputes go to the state or federal courts serving Jackson County, Missouri.",
    ],
  },
  {
    heading: "13. Changes",
    paragraphs: [
      "We may update these terms, and the date above will change when we do.",
    ],
  },
  {
    heading: "14. Contact",
    paragraphs: [
      `${CK_CONTACT_NAME} · ${CK_PHONE} · ${CK_EMAIL}`,
    ],
  },
  {
    heading: "15. Text messaging (SMS) terms",
    paragraphs: [
      "Program: Tolley Clean Outs sends text messages about cleanout quotes, scheduling, arrival times, and job updates to people who opt in by checking the optional SMS consent box on the tolley.io/cleanouts quote form or by texting us first.",
      "Message frequency varies. Message and data rates may apply. Consent is not a condition of purchase.",
      "Reply STOP to opt out at any time; you will get one confirmation and no further texts. Reply HELP for help, or call (913) 283-3826.",
      "Carriers are not liable for delayed or undelivered messages. See our Privacy Policy at tolley.io/cleanouts/privacy for how we handle your information.",
    ],
  },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: "What we collect",
    items: [
      {
        text: "**From you:** your name, phone, email, job address, job date, the photos you text or upload, and notes about the job.",
      },
      {
        text: "**Payment:** card and bank details go straight to Stripe and never pass through our servers. We keep only the amount, the date, the method (card, ACH, cash, or check), and Stripe's receipt reference.",
      },
      {
        text: "**Website:** basic analytics such as pages viewed, device type, and approximate location, plus cookies needed for the site to work.",
      },
    ],
  },
  {
    heading: "How we use it",
    paragraphs: [
      "We use your information to quote, schedule, and do your job; to send invoices and receipts; to contact you about the job; to handle consignment sales; and to keep the business and tax records the law requires. We do not sell your information. We do not send marketing texts or emails unless you ask for them.",
    ],
  },
  {
    heading: "Who we share it with",
    items: [
      { text: "Stripe, to process payments." },
      {
        text: "Our hosting, email, and SMS providers (for example Vercel and our email/SMS service), only to run the service.",
      },
      {
        text: "Buyers of consignment items, who get only what a sale needs. Your address is never shared without your OK.",
      },
      { text: "Authorities, when the law requires it." },
    ],
  },
  {
    heading: "Text messaging and mobile information",
    paragraphs: [
      "If you check the optional SMS consent box on our quote form, we use your mobile number only to text you about your cleanout quote, scheduling, arrival times, and job updates from Tolley Clean Outs.",
      "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent are not shared with any third parties, except service providers (such as our SMS carrier platform) that help us deliver the messages.",
      "Reply STOP to any message to opt out at any time, or HELP for help.",
    ],
  },
  {
    heading: "Photos",
    paragraphs: [
      "Before and after photos are for your records and ours. We won't publish photos of your property or anything that identifies you without your permission.",
    ],
  },
  {
    heading: "Retention",
    paragraphs: [
      "We keep job and payment records for as long as tax law requires (generally 7 years). Photos and notes are deleted when they're no longer needed.",
    ],
  },
  {
    heading: "Your choices",
    paragraphs: [
      `You can ask to see, correct, or delete your information (except records we're legally required to keep). Email ${CK_EMAIL} or call ${CK_PHONE}.`,
    ],
  },
  {
    heading: "Children",
    paragraphs: ["This service is not directed to children under 13."],
  },
  {
    heading: "Changes",
    paragraphs: [
      "We'll post updates here and change the effective date when we do.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      `${CK_CONTACT_NAME} · ${CK_ENTITY} · ${CK_PHONE} · ${CK_EMAIL}`,
    ],
  },
];

const FORBIDDEN_AMOUNT_KEYS = new Set([
  "amount",
  "total",
  "unitAmount",
  "lineAmount",
  "subTotal",
  "amountDue",
  "amountPaid",
  "lineItems",
  "price",
]);

export function hasForbiddenAmountKey(keys: Iterable<string>): boolean {
  for (const key of keys) {
    if (FORBIDDEN_AMOUNT_KEYS.has(key)) return true;
  }
  return false;
}

export function normalizeInvoiceNumber(raw: string): string | null {
  const match = /^INV-(\d{1,10})$/.exec(raw.trim().toUpperCase());
  if (!match) return null;
  return `INV-${match[1]}`;
}

export function termsWereAccepted(value: string | undefined): boolean {
  return value === "yes" || value === "true" || value === "on";
}

export function parsePaymentChoice(value: string | undefined): "card" | "cash" | null {
  if (value === "card" || value === "cash") return value;
  return null;
}

export function formatJobDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return value.trim();
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function cleanoutJobDescription(address: string, date: string): string {
  return `Cleanout – ${address.trim()} – ${formatJobDate(date)}`;
}

export function formatStamp(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
    timeZoneName: "short",
  }).format(date);
}

function appendMarkedLine(existing: string | null, marker: string, line: string): string {
  if (existing?.includes(marker)) return existing;
  const trimmed = existing?.trim();
  return trimmed ? `${trimmed}\n${line}` : line;
}

export function withCleanoutPaymentNotes(
  existing: string | null,
  choice: "card" | "cash",
  at: Date,
): string {
  const stamped = formatStamp(at);
  const notes = appendMarkedLine(
    existing,
    TERMS_ACCEPTED_MARKER,
    `${TERMS_ACCEPTED_MARKER} on ${stamped}.`,
  );
  if (choice !== "cash") return notes;
  return appendMarkedLine(
    notes,
    CASH_NOTE_MARKER,
    `${CASH_NOTE_MARKER} Noted on ${stamped}.`,
  );
}

export interface CleanoutLine {
  description: string;
  quantity: number;
  unitAmount: number;
  accountId: string;
}

export function isCleanoutManagedLine(description: string): boolean {
  return (
    description === CLEANOUT_DEPOSIT_DESCRIPTION ||
    description === CLEANOUT_BALANCE_DESCRIPTION
  );
}

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function cleanoutDepositAmount(jobTotal: number): number | null {
  if (!(jobTotal > CLEANOUT_DEPOSIT_THRESHOLD)) return null;
  return roundMoney(jobTotal * CLEANOUT_DEPOSIT_RATE);
}

/**
 * Keep the flat job price visible, and when it is over $1,000 add a 25% deposit
 * line plus a balancing credit so the invoice total is the deposit due now.
 */
export function syncCleanoutDepositLines<T extends CleanoutLine>(lines: T[], blank: T): T[] {
  const service = lines.filter((line) => !isCleanoutManagedLine(line.description));
  const base = service.length > 0 ? service : [blank];
  const jobTotal = roundMoney(
    base.reduce((sum, line) => sum + line.quantity * line.unitAmount, 0),
  );
  const deposit = cleanoutDepositAmount(jobTotal);
  if (deposit == null) return base;
  const accountId = base.find((line) => line.accountId)?.accountId ?? "";
  const seed = base[0];
  return [
    ...base,
    {
      ...seed,
      description: CLEANOUT_DEPOSIT_DESCRIPTION,
      quantity: 1,
      unitAmount: deposit,
      accountId,
    },
    {
      ...seed,
      description: CLEANOUT_BALANCE_DESCRIPTION,
      quantity: 1,
      unitAmount: roundMoney(-jobTotal),
      accountId,
    },
  ];
}
