/**
 * Unclaimed Funds Compliance Engine
 *
 * Pure computation — no external calls. Encodes jurisdiction-specific
 * fee caps, ban periods, deadlines, and statute references.
 *
 * Key legal constraints:
 * - MO RSMo 447.581: 10-20% tiered by age, agreements void within 12mo of reporting
 * - KS K.S.A. 58-3978: 24-month ban, 15% after
 * - PA 72 P.S. 1301.29.1: No statutory ban (AG enforces ~6mo), 15% cap
 * - Federal (HUD/FDIC): No statutory cap, varies by program
 * - MO Tax Surplus RSMo 140.230: 90-day wait, no statutory cap, 3-year deadline
 */

export type Jurisdiction = "MO" | "KS" | "PA" | "federal";
export type SourceType =
  | "state_unclaimed"
  | "tax_surplus"
  | "hud"
  | "fdic"
  | "missingmoney";

export interface ComplianceInput {
  jurisdiction: Jurisdiction;
  sourceType: SourceType;
  reportDate: Date | null; // when funds were escheated/reported
  saleDate?: Date | null; // for tax surplus: when auction occurred
  amount?: number | null;
}

export interface ComplianceResult {
  isClaimable: boolean;
  currentFeeWindow: string | null;
  maxFeePercent: number | null;
  waitingPeriodEnd: Date | null;
  claimDeadline: Date | null;
  statuteReference: string;
  warnings: string[];
}

/**
 * Compute compliance constraints for a given fund.
 */
export function computeCompliance(
  input: ComplianceInput,
  asOfDate: Date = new Date()
): ComplianceResult {
  const { jurisdiction, sourceType } = input;

  // Route to jurisdiction-specific handler
  if (jurisdiction === "MO" && sourceType === "tax_surplus") {
    return computeMOTaxSurplus(input, asOfDate);
  }
  if (jurisdiction === "MO" && sourceType === "state_unclaimed") {
    return computeMOUnclaimed(input, asOfDate);
  }
  if (jurisdiction === "KS") {
    return computeKSUnclaimed(input, asOfDate);
  }
  if (jurisdiction === "PA") {
    return computePAUnclaimed(input, asOfDate);
  }
  if (sourceType === "hud") {
    return computeHUD(input, asOfDate);
  }
  if (sourceType === "fdic") {
    return computeFDIC(input, asOfDate);
  }

  // Default / unknown — flag for manual review
  return {
    isClaimable: true,
    currentFeeWindow: null,
    maxFeePercent: null,
    waitingPeriodEnd: null,
    claimDeadline: null,
    statuteReference: "Unknown jurisdiction — verify manually",
    warnings: [
      `No compliance rules configured for ${jurisdiction}/${sourceType}. Manual review required.`,
    ],
  };
}

// ── Missouri State Unclaimed Property ───────────────────────

function computeMOUnclaimed(
  input: ComplianceInput,
  asOfDate: Date
): ComplianceResult {
  const warnings: string[] = [];
  const statute = "RSMo 447.581";

  if (!input.reportDate) {
    return {
      isClaimable: false,
      currentFeeWindow: null,
      maxFeePercent: null,
      waitingPeriodEnd: null,
      claimDeadline: null,
      statuteReference: statute,
      warnings: [
        "Report date unknown. Cannot determine fee window. Verify report date before signing any agreement.",
      ],
    };
  }

  const monthsSinceReport = monthsBetween(input.reportDate, asOfDate);

  // 0-12 months: agreements are VOID
  if (monthsSinceReport < 12) {
    const waitEnd = addMonths(input.reportDate, 12);
    return {
      isClaimable: false,
      currentFeeWindow: "0-12mo: VOID (no agreements allowed)",
      maxFeePercent: 0,
      waitingPeriodEnd: waitEnd,
      claimDeadline: null,
      statuteReference: statute,
      warnings: [
        `Agreement would be void. Wait until ${waitEnd.toISOString().split("T")[0]} (12 months from report date).`,
      ],
    };
  }

  // 12-24 months: 10% cap
  if (monthsSinceReport < 24) {
    return {
      isClaimable: true,
      currentFeeWindow: "12-24mo: 10% max",
      maxFeePercent: 10,
      waitingPeriodEnd: null,
      claimDeadline: null,
      statuteReference: statute,
      warnings: [],
    };
  }

  // 24-36 months: 15% cap
  if (monthsSinceReport < 36) {
    return {
      isClaimable: true,
      currentFeeWindow: "24-36mo: 15% max",
      maxFeePercent: 15,
      waitingPeriodEnd: null,
      claimDeadline: null,
      statuteReference: statute,
      warnings: [],
    };
  }

  // 36+ months: 20% cap
  return {
    isClaimable: true,
    currentFeeWindow: "36+mo: 20% max",
    maxFeePercent: 20,
    waitingPeriodEnd: null,
    claimDeadline: null,
    statuteReference: statute,
    warnings: [],
  };
}

// ── Missouri Tax Sale Surplus ───────────────────────────────

function computeMOTaxSurplus(
  input: ComplianceInput,
  asOfDate: Date
): ComplianceResult {
  const warnings: string[] = [];
  const statute = "RSMo 140.230";
  const referenceDate = input.saleDate || input.reportDate;

  if (!referenceDate) {
    return {
      isClaimable: false,
      currentFeeWindow: null,
      maxFeePercent: null,
      waitingPeriodEnd: null,
      claimDeadline: null,
      statuteReference: statute,
      warnings: [
        "Sale date unknown. Cannot determine waiting period or deadline. Verify before proceeding.",
      ],
    };
  }

  const daysSinceSale = daysBetween(referenceDate, asOfDate);
  const waitEnd = addDays(referenceDate, 90);
  const deadline = addYears(referenceDate, 3);

  // Past deadline — funds escheat to county
  if (asOfDate > deadline) {
    return {
      isClaimable: false,
      currentFeeWindow: "EXPIRED — past 3-year deadline",
      maxFeePercent: 0,
      waitingPeriodEnd: null,
      claimDeadline: deadline,
      statuteReference: statute,
      warnings: [
        `3-year claim deadline passed on ${deadline.toISOString().split("T")[0]}. Funds likely escheated to county.`,
      ],
    };
  }

  // Within 90-day waiting period
  if (daysSinceSale < 90) {
    return {
      isClaimable: false,
      currentFeeWindow: "0-90 days: waiting period",
      maxFeePercent: 0,
      waitingPeriodEnd: waitEnd,
      claimDeadline: deadline,
      statuteReference: statute,
      warnings: [
        `90-day waiting period. Claimable after ${waitEnd.toISOString().split("T")[0]}.`,
      ],
    };
  }

  // Claimable — no statutory fee cap, market norm 25-33%
  return {
    isClaimable: true,
    currentFeeWindow: "90+ days: no statutory cap (25-33% market norm)",
    maxFeePercent: null, // no statutory cap
    waitingPeriodEnd: null,
    claimDeadline: deadline,
    statuteReference: statute,
    warnings: [
      `Deadline: ${deadline.toISOString().split("T")[0]} (3 years from sale). No statutory fee cap — 25-33% is market norm.`,
    ],
  };
}

// ── Kansas Unclaimed Property ───────────────────────────────

function computeKSUnclaimed(
  input: ComplianceInput,
  asOfDate: Date
): ComplianceResult {
  const statute = "K.S.A. 58-3978";

  if (!input.reportDate) {
    return {
      isClaimable: false,
      currentFeeWindow: null,
      maxFeePercent: null,
      waitingPeriodEnd: null,
      claimDeadline: null,
      statuteReference: statute,
      warnings: [
        "Report date unknown. KS has a 24-month ban period — verify date before proceeding.",
      ],
    };
  }

  const monthsSinceReport = monthsBetween(input.reportDate, asOfDate);

  // 24-month ban period
  if (monthsSinceReport < 24) {
    const waitEnd = addMonths(input.reportDate, 24);
    return {
      isClaimable: false,
      currentFeeWindow: "0-24mo: BAN (no agreements allowed)",
      maxFeePercent: 0,
      waitingPeriodEnd: waitEnd,
      claimDeadline: null,
      statuteReference: statute,
      warnings: [
        `KS 24-month ban period active. Wait until ${waitEnd.toISOString().split("T")[0]}.`,
      ],
    };
  }

  // After 24 months: 15% cap
  return {
    isClaimable: true,
    currentFeeWindow: "24+mo: 15% max",
    maxFeePercent: 15,
    waitingPeriodEnd: null,
    claimDeadline: null,
    statuteReference: statute,
    warnings: [],
  };
}

// ── Pennsylvania Unclaimed Property ─────────────────────────

function computePAUnclaimed(
  input: ComplianceInput,
  asOfDate: Date
): ComplianceResult {
  const statute = "72 P.S. 1301.29.1";
  const warnings: string[] = [];

  if (!input.reportDate) {
    warnings.push(
      "Report date unknown. PA AG informally enforces ~6mo waiting period. Verify before proceeding."
    );
  }

  // PA has no statutory ban, but AG enforces ~6 months informally
  if (input.reportDate) {
    const monthsSinceReport = monthsBetween(input.reportDate, asOfDate);
    if (monthsSinceReport < 6) {
      const waitEnd = addMonths(input.reportDate, 6);
      warnings.push(
        `PA AG informally enforces ~6mo wait. Report is ${monthsSinceReport} months old. Consider waiting until ${waitEnd.toISOString().split("T")[0]}.`
      );
    }
  }

  return {
    isClaimable: true,
    currentFeeWindow: "15% max (AG-enforced)",
    maxFeePercent: 15,
    waitingPeriodEnd: null,
    claimDeadline: null,
    statuteReference: statute,
    warnings,
  };
}

// ── Federal: HUD/FHA Mortgage Insurance Refunds ─────────────

function computeHUD(
  _input: ComplianceInput,
  _asOfDate: Date
): ComplianceResult {
  return {
    isClaimable: true,
    currentFeeWindow: "No statutory cap",
    maxFeePercent: null,
    waitingPeriodEnd: null,
    claimDeadline: null,
    statuteReference: "HUD Mortgage Insurance — no federal fee cap",
    warnings: [
      "HUD refunds have no fee cap. Owner can claim directly for free at hud.gov. Ethical practice: charge reasonable flat fee or low percentage.",
    ],
  };
}

// ── Federal: FDIC Unclaimed Deposits ────────────────────────

function computeFDIC(
  _input: ComplianceInput,
  _asOfDate: Date
): ComplianceResult {
  return {
    isClaimable: true,
    currentFeeWindow: "No statutory cap",
    maxFeePercent: null,
    waitingPeriodEnd: null,
    claimDeadline: null,
    statuteReference: "FDIC — no federal fee cap (18-month holding period typical)",
    warnings: [
      "FDIC has no fee cap. Owner can claim directly at fdic.gov. Check if 18-month holding period has passed.",
    ],
  };
}

// ── Date Utility Helpers ────────────────────────────────────

function monthsBetween(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const days = end.getDate() - start.getDate();
  return years * 12 + months + (days >= 0 ? 0 : -1);
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

// Re-export helpers for testing
export { monthsBetween, daysBetween, addMonths, addDays, addYears };
