import type { Platform } from "./types";

interface FeeStructure {
  percentFee: number;
  fixedFee: number;
  label: string;
}

export const PLATFORM_FEES: Record<Platform, FeeStructure> = {
  ebay:           { percentFee: 0.1312, fixedFee: 0.30, label: "13.12% + $0.30" },
  mercari:        { percentFee: 0.10,   fixedFee: 0,    label: "10%" },
  poshmark:       { percentFee: 0.20,   fixedFee: 0,    label: "20%" },
  offerup:        { percentFee: 0.129,  fixedFee: 0,    label: "12.9%" },
  fb_marketplace: { percentFee: 0.05,   fixedFee: 0.40, label: "5% + $0.40" },
  amazon:         { percentFee: 0.15,   fixedFee: 0,    label: "15%" },
  shop:           { percentFee: 0.029,  fixedFee: 0.30, label: "2.9% + $0.30 (Stripe)" },
};

export function computeNetAfterFees(price: number, platform: Platform): number {
  const fee = PLATFORM_FEES[platform];
  if (!fee) return price;
  const totalFees = price * fee.percentFee + fee.fixedFee;
  return Math.round((price - totalFees) * 100) / 100;
}

export function computePlatformFees(price: number, platform: Platform): number {
  const fee = PLATFORM_FEES[platform];
  if (!fee) return 0;
  return Math.round((price * fee.percentFee + fee.fixedFee) * 100) / 100;
}

export function computeProfit(price: number, platform: Platform, cogs: number): number {
  const net = computeNetAfterFees(price, platform);
  return Math.round((net - cogs) * 100) / 100;
}

export function computeRoi(profit: number, cogs: number): number {
  if (cogs <= 0) return 0;
  return Math.round((profit / cogs) * 10000) / 100;
}
