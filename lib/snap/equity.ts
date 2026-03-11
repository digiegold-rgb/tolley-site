/**
 * Equity estimation — market value minus estimated mortgage balance.
 * Pure math, no external API calls. Operates on dossier data.
 */

export interface EquityEstimate {
  marketValue: number;
  marketValueSource: string;
  mortgageEstimate: number;
  mortgageMethod: string;
  equityEstimate: number;
  equityPercent: number;
  confidence: "high" | "medium" | "low";
  sources: string[];
}

// Historical average 30-year fixed mortgage rates by year
const HISTORICAL_RATES: Record<number, number> = {
  2000: 8.05, 2001: 6.97, 2002: 6.54, 2003: 5.83, 2004: 5.84,
  2005: 5.87, 2006: 6.41, 2007: 6.34, 2008: 6.03, 2009: 5.04,
  2010: 4.69, 2011: 4.45, 2012: 3.66, 2013: 3.98, 2014: 4.17,
  2015: 3.85, 2016: 3.65, 2017: 3.99, 2018: 4.54, 2019: 3.94,
  2020: 3.11, 2021: 2.96, 2022: 5.34, 2023: 6.81, 2024: 6.72,
  2025: 6.65, 2026: 6.50,
};

function getRateForYear(year: number): number {
  if (year in HISTORICAL_RATES) return HISTORICAL_RATES[year];
  if (year < 2000) return 7.5; // Pre-2000 average
  return 6.5; // Default fallback
}

/**
 * Calculate remaining mortgage balance using standard amortization.
 * Assumes 30-year fixed, 80% LTV at purchase.
 */
function calculateRemainingBalance(
  purchasePrice: number,
  purchaseDate: string | Date,
  ltv: number = 0.80
): { balance: number; originalLoan: number; rate: number; monthsElapsed: number } {
  const date = new Date(purchaseDate);
  const year = date.getFullYear();
  const rate = getRateForYear(year) / 100;
  const monthlyRate = rate / 12;
  const totalMonths = 360; // 30-year fixed
  const originalLoan = purchasePrice * ltv;

  // Months elapsed since purchase
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth());

  if (monthsElapsed <= 0) {
    return { balance: originalLoan, originalLoan, rate, monthsElapsed: 0 };
  }

  if (monthsElapsed >= totalMonths) {
    return { balance: 0, originalLoan, rate, monthsElapsed };
  }

  // Standard amortization formula: B = P * [(1+r)^n - (1+r)^t] / [(1+r)^n - 1]
  const compoundTotal = Math.pow(1 + monthlyRate, totalMonths);
  const compoundElapsed = Math.pow(1 + monthlyRate, monthsElapsed);
  const balance = originalLoan * (compoundTotal - compoundElapsed) / (compoundTotal - 1);

  return {
    balance: Math.max(0, Math.round(balance)),
    originalLoan,
    rate,
    monthsElapsed,
  };
}

interface DossierData {
  zestimate?: number;
  refdinEstimate?: number;
  marketValue?: number;
  assessedValue?: number;
  assessmentRatio?: number;
  listPrice?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  deedHistory?: Array<{ price?: number | null; date?: string; type?: string }>;
  // NARRPR data (actual mortgage + MLS-informed valuation)
  narrprMortgage?: { amount: number; date: string; lender: string; type: string; rate?: number };
  narrprRvm?: { value: number; confidence: number; low?: number; high?: number };
}

/**
 * Estimate property equity from available dossier data.
 */
export function estimateEquity(data: DossierData): EquityEstimate | null {
  const sources: string[] = [];

  // 1. Determine market value (best available)
  let marketValue: number | undefined;
  let marketValueSource = "";

  // Market value priority: Zestimate > NARRPR RVM (high confidence) > Redfin >
  // NARRPR RVM (low confidence) > County > List Price
  if (data.zestimate && data.zestimate > 0) {
    marketValue = data.zestimate;
    marketValueSource = "Zillow Zestimate";
    sources.push("Zillow");
  } else if (data.narrprRvm && data.narrprRvm.value > 0 && data.narrprRvm.confidence >= 0.7) {
    marketValue = data.narrprRvm.value;
    marketValueSource = "NARRPR RVM (high confidence)";
    sources.push("NARRPR");
  } else if (data.refdinEstimate && data.refdinEstimate > 0) {
    marketValue = data.refdinEstimate;
    marketValueSource = "Redfin Estimate";
    sources.push("Redfin");
  } else if (data.narrprRvm && data.narrprRvm.value > 0) {
    marketValue = data.narrprRvm.value;
    marketValueSource = "NARRPR RVM";
    sources.push("NARRPR");
  } else if (data.marketValue && data.marketValue > 0) {
    marketValue = data.marketValue;
    marketValueSource = "County Market Value";
    sources.push("County Assessor");
  } else if (data.assessedValue && data.assessmentRatio) {
    marketValue = Math.round(data.assessedValue / data.assessmentRatio);
    marketValueSource = "County Assessed (adjusted)";
    sources.push("County Assessor");
  } else if (data.listPrice && data.listPrice > 0) {
    marketValue = data.listPrice;
    marketValueSource = "Current List Price";
    sources.push("MLS");
  }

  if (!marketValue) return null;

  // 2. Find last sale for mortgage estimate
  let lastSalePrice = data.lastSalePrice;
  let lastSaleDate = data.lastSaleDate;

  // Check deed history for most recent sale
  if (!lastSalePrice && data.deedHistory?.length) {
    const sales = data.deedHistory
      .filter((d) => d.price && d.price > 0 && d.date)
      .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

    if (sales.length > 0) {
      lastSalePrice = sales[0].price!;
      lastSaleDate = sales[0].date;
      sources.push("Deed History");
    }
  }

  // 3. Calculate mortgage estimate
  let mortgageEstimate = 0;
  let mortgageMethod = "No sale history — assuming no mortgage";
  let confidence: EquityEstimate["confidence"] = "low";

  if (data.narrprMortgage) {
    // Use actual NARRPR mortgage data — amortize from real amount/rate/date
    const m = data.narrprMortgage;
    const rate = m.rate || getRateForYear(new Date(m.date).getFullYear());
    const amort = calculateRemainingBalance(
      m.amount / 0.80, // Reverse LTV assumption since calculateRemainingBalance applies 80% LTV
      m.date,
      m.amount / (m.amount / 0.80) // Pass actual LTV
    );
    // Override with actual loan balance calculation
    const monthlyRate = (rate / 100) / 12;
    const totalMonths = 360;
    const now = new Date();
    const origDate = new Date(m.date);
    const monthsElapsed = (now.getFullYear() - origDate.getFullYear()) * 12 + (now.getMonth() - origDate.getMonth());
    if (monthsElapsed >= totalMonths) {
      mortgageEstimate = 0;
    } else if (monthsElapsed <= 0) {
      mortgageEstimate = m.amount;
    } else {
      const compoundTotal = Math.pow(1 + monthlyRate, totalMonths);
      const compoundElapsed = Math.pow(1 + monthlyRate, monthsElapsed);
      mortgageEstimate = Math.max(0, Math.round(m.amount * (compoundTotal - compoundElapsed) / (compoundTotal - 1)));
    }
    const yearsAgo = Math.round(monthsElapsed / 12);
    mortgageMethod = `NARRPR actual: $${m.amount.toLocaleString()} ${m.type} from ${m.lender} (${yearsAgo}yr ago) at ${rate.toFixed(1)}%`;
    sources.push("NARRPR Mortgage");
    confidence = "high";
  } else if (lastSalePrice && lastSaleDate) {
    const amort = calculateRemainingBalance(lastSalePrice, lastSaleDate);
    mortgageEstimate = amort.balance;
    const yearsAgo = Math.round(amort.monthsElapsed / 12);
    mortgageMethod = `Amortized from $${lastSalePrice.toLocaleString()} purchase (${yearsAgo}yr ago) at ${(amort.rate * 100).toFixed(1)}% 30yr fixed, 80% LTV`;

    confidence = marketValueSource.includes("Zestimate") || marketValueSource.includes("Redfin") || marketValueSource.includes("NARRPR")
      ? "high"
      : "medium";
  }

  const equityEstimate = marketValue - mortgageEstimate;
  const equityPercent = Math.round((equityEstimate / marketValue) * 100);

  return {
    marketValue,
    marketValueSource,
    mortgageEstimate,
    mortgageMethod,
    equityEstimate,
    equityPercent,
    confidence,
    sources,
  };
}
