// ─── Keagan Partnership Hub Constants ───

export const TRAILER_SPLIT = { tolley: 0.5, keegan: 0.5 }; // Straight 50/50

export const CATEGORY_LABELS: Record<string, string> = {
  wd: "W&D Rental",
  trailer: "Trailer Rental",
  labor: "Labor",
  other: "Other",
};

export const CATEGORY_COLORS: Record<string, string> = {
  wd: "#4472c4",
  trailer: "#ed7d31",
  labor: "#70ad47",
  other: "#a5a5a5",
};

export const HUB_NAV = [
  { label: "Hub", href: "/keegan" },
  { label: "WD", href: "/keegan/wd" },
  { label: "Trailer", href: "/keegan/trailer" },
  { label: "Payments", href: "/keegan/payments" },
] as const;

export function computeTrailerSplit(totalPaid: number) {
  return {
    tolleySplit: Math.round(totalPaid * TRAILER_SPLIT.tolley * 100) / 100,
    keeganSplit: Math.round(totalPaid * TRAILER_SPLIT.keegan * 100) / 100,
  };
}
