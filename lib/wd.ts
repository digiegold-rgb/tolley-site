export const WD_STRIPE_CHECKOUT_WASHER_URL = "https://buy.stripe.com/9B628k3fE5RJ2DQ8NN18c02";
export const WD_STRIPE_CHECKOUT_URL = "https://buy.stripe.com/00w14g03sgwn4LYe8718c00";
export const WD_STRIPE_PORTAL_URL = "https://billing.stripe.com/p/login/00w14g03sgwn4LYe8718c00";
export const WD_PRICE_WASHER = 42;
export const WD_PRICE_BUNDLE = 58;
export const WD_CONTACT_EMAIL = "Jared@yourkchomes.com";
export const WD_CONTACT_PHONE = "913-283-3826";
export const WD_FACEBOOK_URL = "https://www.facebook.com/share/1AafKhE5tq/?mibextid=wwXIfr";
export const WD_BRAND = "Wash & Dry Rental";
export const WD_COMPANY = "Your KC Homes LLC";

// ─── Revenue Split Constants ───

export const WD_STRIPE_FEE_RATE = 0.0412; // 4.12%
export const WD_PAYBACK_BUYER_SHARE = 0.75;
export const WD_PAYBACK_OTHER_SHARE = 0.25;
export const WD_POST_PAYBACK_KEEGAN_SOURCE = { keegan: 0.6, tolley: 0.4 };
export const WD_POST_PAYBACK_DEFAULT = { keegan: 0.5, tolley: 0.5 };

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
  keeganSplit: number;
  paybackComplete: boolean;
  paybackRemaining: number;
}

export function computeRevenueSplit(client: WdClientForSplit): RevenueSplitResult {
  const payments = [...client.payments].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let totalRevenue = 0;
  let tolleySplit = 0;
  let keeganSplit = 0;
  let paidBack = 0;
  const unitCost = client.unitCost;

  for (const p of payments) {
    totalRevenue += p.amount;

    if (paidBack < unitCost) {
      // Payback phase
      const remaining = unitCost - paidBack;
      const paybackPortion = Math.min(p.amount, remaining);
      const postPaybackPortion = p.amount - paybackPortion;

      // Payback split: buyer gets 75%, other gets 25%
      if (client.paidBy === "tolley") {
        tolleySplit += paybackPortion * WD_PAYBACK_BUYER_SHARE;
        keeganSplit += paybackPortion * WD_PAYBACK_OTHER_SHARE;
      } else {
        keeganSplit += paybackPortion * WD_PAYBACK_BUYER_SHARE;
        tolleySplit += paybackPortion * WD_PAYBACK_OTHER_SHARE;
      }
      paidBack += paybackPortion;

      // Any overflow goes to post-payback split
      if (postPaybackPortion > 0) {
        const split = client.source === "keegan"
          ? WD_POST_PAYBACK_KEEGAN_SOURCE
          : WD_POST_PAYBACK_DEFAULT;
        tolleySplit += postPaybackPortion * split.tolley;
        keeganSplit += postPaybackPortion * split.keegan;
      }
    } else {
      // Post-payback phase
      const split = client.source === "keegan"
        ? WD_POST_PAYBACK_KEEGAN_SOURCE
        : WD_POST_PAYBACK_DEFAULT;
      tolleySplit += p.amount * split.tolley;
      keeganSplit += p.amount * split.keegan;
    }
  }

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    tolleySplit: Math.round(tolleySplit * 100) / 100,
    keeganSplit: Math.round(keeganSplit * 100) / 100,
    paybackComplete: paidBack >= unitCost,
    paybackRemaining: Math.max(0, Math.round((unitCost - paidBack) * 100) / 100),
  };
}
