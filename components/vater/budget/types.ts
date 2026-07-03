export type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
};

export type CategoryState = {
  id: string;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  monthlyLimitCents: number;
  spentCents: number;
  remainingCents: number;
  pctUsed: number;
  sortOrder: number;
};

export type EntryWithCategory = {
  id: string;
  amountCents: number;
  vendor: string | null;
  note: string | null;
  tags: string[];
  occurredAt: string | Date;
  source: "MANUAL" | "VOICE" | "PLAID";
  rawText: string | null;
  needsReview: boolean;
  category: CategoryOption | null;
};

export type Hero = {
  monthName: string;
  totalLimitCents: number;
  totalSpentCents: number;
  totalRemainingCents: number;
  pctUsed: number;
};
