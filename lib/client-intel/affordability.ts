interface AffordabilityResult {
  maxMonthlyHousing: number;
  maxHomePrice: number;
  assumptions: {
    annualIncome: number;
    dtiRatio: number;
    rate: number;
    termYears: number;
    annualTaxRate: number;
    annualInsurance: number;
    downPaymentPct: number;
  };
}

export function calculateAffordability(
  annualIncome: number,
  options?: {
    rate?: number; // annual interest rate (default 6.5%)
    termYears?: number; // loan term (default 30)
    dtiRatio?: number; // front-end DTI (default 0.28)
    annualTaxRate?: number; // property tax as % of home value (default 1.2%)
    annualInsurance?: number; // annual insurance (default 1500)
    downPaymentPct?: number; // down payment % (default 5%)
  }
): AffordabilityResult {
  const rate = options?.rate ?? 0.065;
  const termYears = options?.termYears ?? 30;
  const dtiRatio = options?.dtiRatio ?? 0.28;
  const annualTaxRate = options?.annualTaxRate ?? 0.012;
  const annualInsurance = options?.annualInsurance ?? 1500;
  const downPaymentPct = options?.downPaymentPct ?? 0.05;

  const monthlyIncome = annualIncome / 12;
  const maxMonthlyHousing = Math.round(monthlyIncome * dtiRatio);

  // Work backwards: maxMonthlyHousing = P&I + taxes + insurance
  // P&I = maxMonthlyHousing - monthlyTax - monthlyInsurance
  // monthlyTax = homePrice * annualTaxRate / 12
  // monthlyInsurance = annualInsurance / 12
  // P&I = loanAmount * [r(1+r)^n] / [(1+r)^n - 1]  where r = monthly rate, n = months
  // loanAmount = homePrice * (1 - downPaymentPct)

  const monthlyInsurance = annualInsurance / 12;
  const monthlyRate = rate / 12;
  const numPayments = termYears * 12;

  // Factor: the monthly P&I per $1 of loan
  const piPerDollar =
    (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);

  // Solve: maxMonthlyHousing = homePrice*(1-downPct)*piPerDollar + homePrice*taxRate/12 + monthlyInsurance
  // maxMonthlyHousing - monthlyInsurance = homePrice * ((1-downPct)*piPerDollar + taxRate/12)
  const availableForPI = maxMonthlyHousing - monthlyInsurance;
  if (availableForPI <= 0) {
    return {
      maxMonthlyHousing,
      maxHomePrice: 0,
      assumptions: { annualIncome, dtiRatio, rate, termYears, annualTaxRate, annualInsurance, downPaymentPct },
    };
  }

  const costPerDollarHome = (1 - downPaymentPct) * piPerDollar + annualTaxRate / 12;
  const maxHomePrice = Math.round(availableForPI / costPerDollarHome);

  return {
    maxMonthlyHousing,
    maxHomePrice,
    assumptions: { annualIncome, dtiRatio, rate, termYears, annualTaxRate, annualInsurance, downPaymentPct },
  };
}
