import { WD_SERVICE_CITY_LABELS } from "./wd-service-zips";

export const WD_STRIPE_CHECKOUT_WASHER_URL = "https://buy.stripe.com/9B628k3fE5RJ2DQ8NN18c02";
export const WD_STRIPE_CHECKOUT_URL = "https://buy.stripe.com/00w14g03sgwn4LYe8718c00";
/** $42/mo washer. Same price id as the analytics dashboard. */
export const WD_STRIPE_PRICE_WASHER = "price_1SB0UF29zOZYc3GpYYrlpCFe";
/** $58/mo washer + dryer. Also recognized by lib/wd-product.ts. */
export const WD_STRIPE_PRICE_BUNDLE = "price_1Rxey029zOZYc3GpfoFkUbmv";
export const WD_STRIPE_PORTAL_URL = "https://billing.stripe.com/p/login/00w14g03sgwn4LYe8718c00";
export const WD_SITE_URL = "https://tolley.io/wd";
export const WD_PRICE_WASHER = 42;
export const WD_PRICE_BUNDLE = 58;
export const WD_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const WD_CONTACT_PHONE = "913-283-3826";
export const WD_SMS_PHONE = "913-600-7508";
export const WD_WELCOME_FROM = "Jared <jared@yourkchomes.com>";
/** Live W/D A2P Messaging Service (sender +19136007508). Public resource id, not a secret. */
export const WD_MESSAGING_SERVICE_SID = "MG82db38fc4ae258c8869e4f0ae6c525ed";

export type WdPreWelcomedCustomer = {
  stripeCustomerId: string;
  smsSid: string;
  emailId: string;
  welcomedAt: string;
};

/** Manual welcomes that must never be auto-sent again. Dorothy Johnson, 2026-09-12 ~12:41 CT. */
export const WD_PRE_WELCOMED_CUSTOMERS: readonly WdPreWelcomedCustomer[] = [
  {
    stripeCustomerId: "cus_VFPkiB9RKXHrep",
    smsSid: "SMc8426e22b6d97ba7cbc8609a01fb06a1",
    emailId: "1a096d6a31068fcc",
    welcomedAt: "2026-09-12T17:41:00.000Z",
  },
];

export function wdPreWelcomedCustomer(custId?: string | null): WdPreWelcomedCustomer | undefined {
  if (!custId) return undefined;
  return WD_PRE_WELCOMED_CUSTOMERS.find((c) => c.stripeCustomerId === custId);
}
export const WD_FACEBOOK_URL = "https://www.facebook.com/share/1AafKhE5tq/?mibextid=wwXIfr";
export const WD_BRAND = "Wash & Dry Rental";
export const WD_COMPANY = "Your KC Homes LLC";

// ─── Revenue Split Constants ───

export const WD_STRIPE_FEE_RATE = 0.0412; // 4.12%
export const WD_PAYBACK_BUYER_SHARE = 0.75;
export const WD_PAYBACK_OTHER_SHARE = 0.25;

interface WdPaymentRecord {
  amount: number;
  month: string;
  createdAt: string | Date;
}

interface WdClientForSplit {
  unitCost: number;
  source: string;
  paidBy: string;
  payments: WdPaymentRecord[];
}

export interface RevenueSplitResult {
  totalRevenue: number;
  tolleySplit: number;
  paybackComplete: boolean;
  paybackRemaining: number;
}

export function computeRevenueSplit(client: WdClientForSplit): RevenueSplitResult {
  const payments = [...client.payments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let totalRevenue = 0;
  let tolleySplit = 0;
  let paidBack = 0;
  const unitCost = client.unitCost;

  for (const p of payments) {
    totalRevenue += p.amount;
    tolleySplit += p.amount;

    if (paidBack < unitCost) {
      const remaining = unitCost - paidBack;
      const paybackPortion = Math.min(p.amount, remaining);
      paidBack += paybackPortion;
    }
  }

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    tolleySplit: Math.round(tolleySplit * 100) / 100,
    paybackComplete: paidBack >= unitCost,
    paybackRemaining: Math.max(0, Math.round((unitCost - paidBack) * 100) / 100),
  };
}

/** Public FAQ — single source for /wd HTML, FAQPage JSON-LD, and llms-full.txt. */
export const WD_FAQ: { q: string; a: string }[] = [
  { q: "What\u2019s included in the washer and dryer rental?", a: "Every rental includes free delivery, professional installation, ongoing maintenance, and replacement coverage if a machine fails. You just pay the monthly subscription." },
  { q: "How much does washer and dryer rental cost in Kansas City?", a: `Washer only is $${WD_PRICE_WASHER}/mo. Washer + dryer bundle is $${WD_PRICE_BUNDLE}/mo. No hidden fees, no deposits, no credit check.` },
  { q: "How do I cancel?", a: "Cancel anytime before your next billing date \u2014 no cancellation fees. We\u2019ll schedule a pickup within 5 business days." },
  { q: "What areas do you serve?", a: `We deliver within about 25 minutes of Independence, MO 64052: ${WD_SERVICE_CITY_LABELS.join(", ")}. Enter your ZIP when you sign up. If we can't deliver there yet, leave your number and we'll reach out if that changes.` },
  { q: "What if my machine breaks down?", a: "We repair or replace within 48 hours at no extra cost. Just report the issue and we handle the rest." },
  { q: "Do you offer referral discounts?", a: "Yes \u2014 refer a friend and get 50% off your next month. Ask us for details when you sign up." },
  { q: "How do I get support or sign up?", a: `Call or text ${WD_CONTACT_PHONE} or email ${WD_CONTACT_EMAIL}. We\u2019re a local Kansas City business and respond fast.` },
];
