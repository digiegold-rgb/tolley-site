/**
 * Compliance Engine Unit Tests
 *
 * Covers all jurisdiction/source combinations with edge cases
 * around date boundaries, missing data, and expired claims.
 */

import { computeCompliance } from "./compliance";
import type { ComplianceInput, Jurisdiction, SourceType } from "./compliance";

// Helper to create dates relative to a fixed "now"
const NOW = new Date("2026-03-11T12:00:00Z");

function monthsAgo(months: number): Date {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - months);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return d;
}

function yearsAgo(years: number): Date {
  const d = new Date(NOW);
  d.setFullYear(d.getFullYear() - years);
  return d;
}

function input(
  jurisdiction: Jurisdiction,
  sourceType: SourceType,
  reportDate: Date | null,
  saleDate?: Date | null
): ComplianceInput {
  return { jurisdiction, sourceType, reportDate, saleDate };
}

// ── Missouri State Unclaimed ────────────────────────────────

describe("MO State Unclaimed (RSMo 447.581)", () => {
  test("0-12 months: agreements are VOID", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(6)),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.maxFeePercent).toBe(0);
    expect(result.currentFeeWindow).toContain("VOID");
    expect(result.waitingPeriodEnd).toBeTruthy();
    expect(result.statuteReference).toBe("RSMo 447.581");
  });

  test("exactly 11 months: still VOID", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(11)),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.maxFeePercent).toBe(0);
  });

  test("12-24 months: 10% cap", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(18)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(10);
    expect(result.currentFeeWindow).toContain("10%");
    expect(result.waitingPeriodEnd).toBeNull();
  });

  test("24-36 months: 15% cap", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(30)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(15);
    expect(result.currentFeeWindow).toContain("15%");
  });

  test("36+ months: 20% cap", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(48)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(20);
    expect(result.currentFeeWindow).toContain("20%");
  });

  test("boundary: exactly 12 months = 10% window", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(12)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(10);
  });

  test("boundary: exactly 24 months = 15% window", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(24)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(15);
  });

  test("boundary: exactly 36 months = 20% window", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", monthsAgo(36)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(20);
  });

  test("null report date: not claimable with warning", () => {
    const result = computeCompliance(
      input("MO", "state_unclaimed", null),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Report date unknown");
  });
});

// ── Missouri Tax Surplus ────────────────────────────────────

describe("MO Tax Surplus (RSMo 140.230)", () => {
  test("within 90-day wait: not claimable", () => {
    const result = computeCompliance(
      input("MO", "tax_surplus", null, daysAgo(45)),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.currentFeeWindow).toContain("waiting period");
    expect(result.waitingPeriodEnd).toBeTruthy();
    expect(result.claimDeadline).toBeTruthy();
  });

  test("after 90 days: claimable, no fee cap", () => {
    const result = computeCompliance(
      input("MO", "tax_surplus", null, daysAgo(120)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBeNull(); // no statutory cap
    expect(result.claimDeadline).toBeTruthy();
    expect(result.currentFeeWindow).toContain("no statutory cap");
  });

  test("past 3-year deadline: expired", () => {
    const result = computeCompliance(
      input("MO", "tax_surplus", null, yearsAgo(4)),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.currentFeeWindow).toContain("EXPIRED");
  });

  test("boundary: exactly 90 days = claimable", () => {
    const result = computeCompliance(
      input("MO", "tax_surplus", null, daysAgo(90)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
  });

  test("boundary: day 89 = not claimable", () => {
    const result = computeCompliance(
      input("MO", "tax_surplus", null, daysAgo(89)),
      NOW
    );
    expect(result.isClaimable).toBe(false);
  });

  test("null sale date: not claimable with warning", () => {
    const result = computeCompliance(
      input("MO", "tax_surplus", null, null),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.warnings[0]).toContain("Sale date unknown");
  });

  test("uses reportDate as fallback if no saleDate", () => {
    const result = computeCompliance(
      input("MO", "tax_surplus", daysAgo(120)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
  });
});

// ── Kansas Unclaimed ────────────────────────────────────────

describe("KS Unclaimed (K.S.A. 58-3978)", () => {
  test("within 24-month ban: not claimable", () => {
    const result = computeCompliance(
      input("KS", "state_unclaimed", monthsAgo(12)),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.maxFeePercent).toBe(0);
    expect(result.currentFeeWindow).toContain("BAN");
    expect(result.waitingPeriodEnd).toBeTruthy();
  });

  test("after 24 months: 15% cap", () => {
    const result = computeCompliance(
      input("KS", "state_unclaimed", monthsAgo(30)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(15);
    expect(result.currentFeeWindow).toContain("15%");
  });

  test("boundary: exactly 24 months = claimable", () => {
    const result = computeCompliance(
      input("KS", "state_unclaimed", monthsAgo(24)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(15);
  });

  test("null report date: not claimable with warning", () => {
    const result = computeCompliance(
      input("KS", "state_unclaimed", null),
      NOW
    );
    expect(result.isClaimable).toBe(false);
    expect(result.warnings[0]).toContain("24-month ban");
  });
});

// ── Pennsylvania Unclaimed ──────────────────────────────────

describe("PA Unclaimed (72 P.S. 1301.29.1)", () => {
  test("always claimable (no statutory ban), 15% cap", () => {
    const result = computeCompliance(
      input("PA", "state_unclaimed", monthsAgo(1)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(15);
  });

  test("within 6 months: claimable but with AG warning", () => {
    const result = computeCompliance(
      input("PA", "state_unclaimed", monthsAgo(3)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.warnings.some((w) => w.includes("AG"))).toBe(true);
  });

  test("after 6 months: claimable, no warning", () => {
    const result = computeCompliance(
      input("PA", "state_unclaimed", monthsAgo(12)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBe(15);
    expect(result.warnings.length).toBe(0);
  });

  test("null report date: claimable with warning", () => {
    const result = computeCompliance(
      input("PA", "state_unclaimed", null),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.warnings[0]).toContain("Report date unknown");
  });
});

// ── Federal: HUD ────────────────────────────────────────────

describe("HUD Mortgage Insurance Refunds", () => {
  test("always claimable, no fee cap", () => {
    const result = computeCompliance(input("MO", "hud", null), NOW);
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBeNull();
    expect(result.warnings.some((w) => w.includes("hud.gov"))).toBe(true);
  });
});

// ── Federal: FDIC ───────────────────────────────────────────

describe("FDIC Unclaimed Deposits", () => {
  test("always claimable, no fee cap", () => {
    const result = computeCompliance(input("MO", "fdic", null), NOW);
    expect(result.isClaimable).toBe(true);
    expect(result.maxFeePercent).toBeNull();
    expect(result.warnings.some((w) => w.includes("fdic.gov"))).toBe(true);
  });
});

// ── Unknown Jurisdiction ────────────────────────────────────

describe("Unknown jurisdiction fallback", () => {
  test("returns claimable with manual review warning", () => {
    // @ts-expect-error — testing unknown jurisdiction
    const result = computeCompliance(
      input("TX" as Jurisdiction, "state_unclaimed", monthsAgo(12)),
      NOW
    );
    expect(result.isClaimable).toBe(true);
    expect(result.warnings[0]).toContain("Manual review");
  });
});
