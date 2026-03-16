import { DISPATCH_RATES } from "./constants";

export interface QuoteInput {
  distanceMi: number;
  weightLbs?: number;
  urgency?: "asap" | "standard" | "scheduled";
  requiresTrailer?: boolean;
  requiresTempControl?: boolean;
  isFragile?: boolean;
}

export interface QuoteResult {
  distanceMi: number;
  basePrice: number;
  surcharges: { label: string; amount: number }[];
  subtotal: number;
  urgencyAdjustment: number;
  clientPrice: number;
  platformFee: number;
  driverPay: number;
  industryEstimate: number;
  clientSavings: number;
  driverBonusVsGig: number;
}

export function calculateQuote(input: QuoteInput): QuoteResult {
  const r = DISPATCH_RATES;
  const distanceMi = Math.max(input.distanceMi, 0);

  // Base price
  let basePrice = distanceMi * r.basePricePerMile;
  if (basePrice < r.minimumCharge) basePrice = r.minimumCharge;

  // Surcharges
  const surcharges: { label: string; amount: number }[] = [];

  if (input.weightLbs && input.weightLbs > r.weightSurchargeThreshold) {
    const overWeight = input.weightLbs - r.weightSurchargeThreshold;
    const weightFee =
      Math.ceil(overWeight / 100) * r.weightSurchargePerCwt;
    surcharges.push({ label: "Heavy item", amount: weightFee });
  }

  if (input.requiresTrailer) {
    surcharges.push({ label: "Trailer required", amount: r.trailerSurcharge });
  }

  if (input.requiresTempControl) {
    surcharges.push({
      label: "Temperature control",
      amount: r.tempControlSurcharge,
    });
  }

  if (input.isFragile) {
    surcharges.push({ label: "Fragile handling", amount: r.fragileSurcharge });
  }

  const surchargeTotal = surcharges.reduce((s, x) => s + x.amount, 0);
  const subtotal = basePrice + surchargeTotal;

  // Urgency adjustment
  let urgencyAdjustment = 0;
  if (input.urgency === "asap") {
    urgencyAdjustment = subtotal * (r.asapMultiplier - 1);
  } else if (input.urgency === "scheduled") {
    urgencyAdjustment = -(subtotal * r.scheduledDiscount);
  }

  const clientPrice = round(subtotal + urgencyAdjustment);
  const platformFee = round(clientPrice * r.platformFeePercent);
  const driverPay = round(clientPrice - platformFee);

  // Industry comparison — typical gig apps charge ~60% markup
  // so client pays 1.6x what driver gets. We show what they'd pay elsewhere.
  const industryDriverPay = driverPay; // same work, same driver
  const industryEstimate = round(
    industryDriverPay / (1 - r.industryMarkup)
  );
  const clientSavings = round(industryEstimate - clientPrice);

  // How much more driver earns vs typical gig (driver gets ~40% on gig apps)
  const typicalGigDriverPay = round(industryEstimate * (1 - r.industryMarkup));
  const driverBonusVsGig = round(driverPay - typicalGigDriverPay);

  return {
    distanceMi: round(distanceMi),
    basePrice: round(basePrice),
    surcharges,
    subtotal: round(subtotal),
    urgencyAdjustment: round(urgencyAdjustment),
    clientPrice,
    platformFee,
    driverPay,
    industryEstimate,
    clientSavings,
    driverBonusVsGig,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
