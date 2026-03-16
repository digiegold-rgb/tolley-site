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
