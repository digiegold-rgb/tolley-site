/** Fixed-rate purchase estimates. Fee sources and assumptions are shown in the UI. */
export type LoanType = "conventional" | "fha" | "va" | "usda";
export const LOANS: Record<LoanType, { name: string; minimum: number; hint: string; description: string }> = {
  conventional: { name: "Conventional", minimum: 3, hint: "3%+ down", description: "Flexible down payments. PMI is estimated below 20% down; the actual premium depends on your lender, credit and loan." },
  fha: { name: "FHA", minimum: 3.5, hint: "3.5%+ down", description: "Includes upfront and annual FHA mortgage insurance. The 3.5% minimum requires qualifying credit; some buyers need 10% down." },
  va: { name: "VA", minimum: 0, hint: "0% down eligible", description: "For eligible service members, veterans and surviving spouses. No monthly mortgage insurance; a funding fee may apply." },
  usda: { name: "USDA", minimum: 0, hint: "0% down eligible", description: "USDA Guaranteed purchase loans for eligible homes and households. Income and location restrictions apply; includes guarantee fees." },
};
export type MortgageInputs = {
  loan: LoanType; price: number; down: number; rate: number; years: number;
  taxRate: number; insurance: number; hoa: number; pmiRate: number;
  closingRate: number; financeFee: boolean; vaUse: "first" | "subsequent" | "exempt";
};
export const DEFAULT_MORTGAGE: MortgageInputs = {
  loan: "conventional", price: 350000, down: 5, rate: 6.5, years: 30,
  taxRate: 1.2, insurance: 1800, hoa: 0, pmiRate: 0.5,
  closingRate: 3, financeFee: true, vaUse: "first",
};
export function normalizeMortgage(input: Partial<MortgageInputs>): MortgageInputs {
  const d = DEFAULT_MORTGAGE;
  const loan = Object.hasOwn(LOANS, input.loan ?? "") ? input.loan as LoanType : d.loan;
  const number = (value: unknown, fallback: number, min: number, max: number) => typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  return {
    loan, price: number(input.price, d.price, 10000, 5000000), down: number(input.down, d.down, LOANS[loan].minimum, 100),
    rate: number(input.rate, d.rate, 0, 20), years: loan === "usda" ? 30 : [10, 15, 20, 25, 30].includes(input.years ?? 0) ? input.years! : d.years,
    taxRate: number(input.taxRate, d.taxRate, 0, 10), insurance: number(input.insurance, d.insurance, 0, 100000),
    hoa: number(input.hoa, d.hoa, 0, 10000), pmiRate: number(input.pmiRate, d.pmiRate, 0, 5),
    closingRate: number(input.closingRate, d.closingRate, 0, 10), financeFee: typeof input.financeFee === "boolean" ? input.financeFee : d.financeFee,
    vaUse: ["first", "subsequent", "exempt"].includes(input.vaUse ?? "") ? input.vaUse! : d.vaUse,
  };
}
export function monthlyPrincipalInterest(principal: number, rate: number, months: number) {
  if (principal <= 0) return 0;
  const r = rate / 1200;
  return r === 0 ? principal / months : principal * r / -Math.expm1(-months * Math.log1p(r));
}
export function fhaAnnualRate(base: number, down: number, years: number) {
  if (years > 15) return (base > 726200 ? 0.7 : 0.5) + (down < 5 ? 0.05 : 0);
  if (base <= 726200) return down >= 10 ? 0.15 : 0.4;
  return down >= 22 ? 0.15 : down >= 10 ? 0.4 : 0.65;
}
export function calculateMortgage(raw: MortgageInputs) {
  const input = normalizeMortgage(raw);
  const { loan, price, down, rate, years } = input;
  const months = years * 12;
  const downPayment = price * down / 100;
  const base = price - downPayment;
  const upfrontRate = loan === "fha" ? 1.75 : loan === "usda" ? 1 : loan === "va" && input.vaUse !== "exempt" ? down >= 10 ? 1.25 : down >= 5 ? 1.5 : input.vaUse === "first" ? 2.15 : 3.3 : 0;
  const upfrontFee = base * upfrontRate / 100;
  const principal = base + (input.financeFee ? upfrontFee : 0);
  const pi = monthlyPrincipalInterest(principal, rate, months);
  const annualMiRate = loan === "fha" ? fhaAnnualRate(base, down, years) : loan === "usda" ? 0.35 : loan === "conventional" && down < 20 ? input.pmiRate : 0;
  const taxes = price * input.taxRate / 1200;
  const insurance = input.insurance / 12;
  let balance = principal;
  let totalInterest = 0;
  let totalMi = 0;
  let firstMi = 0;
  let miEndMonth = 0;
  const annual: { year: number; principal: number; interest: number; insurance: number; balance: number }[] = [];
  for (let year = 1; year <= years; year++) {
    const rows: { opening: number; closing: number; interest: number; paid: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const interest = balance * rate / 1200;
      const paid = Math.min(balance, Math.max(0, pi - interest));
      rows.push({ opening: balance, closing: Math.max(0, balance - paid), interest, paid });
      balance = Math.max(0, balance - paid);
    }
    // Government annual fees use average scheduled balances. FHA excludes financed upfront MIP.
    const average = rows.reduce((sum, row) => sum + row.opening, 0) / 12;
    const governmentMonthly = average * (loan === "fha" && principal ? base / principal : 1) * annualMiRate / 1200;
    let yearMi = 0;
    rows.forEach((row, index) => {
      const month = (year - 1) * 12 + index + 1;
      const eligible = base > 0 && (loan === "conventional" ? down < 20 && row.opening > price * 0.78 + 0.005 && month <= months / 2 : loan === "fha" ? down < 10 || month <= 132 : loan === "usda");
      const mi = eligible ? loan === "conventional" ? base * annualMiRate / 1200 : governmentMonthly : 0;
      if (month === 1) firstMi = mi;
      if (mi > 0) miEndMonth = month;
      yearMi += mi;
    });
    const interest = rows.reduce((sum, row) => sum + row.interest, 0);
    totalInterest += interest;
    totalMi += yearMi;
    annual.push({ year, principal: rows.reduce((sum, row) => sum + row.paid, 0), interest, insurance: yearMi, balance });
  }
  const closingCosts = price * input.closingRate / 100;
  const cashToClose = downPayment + closingCosts + (input.financeFee ? 0 : upfrontFee);
  const monthly = pi + taxes + insurance + input.hoa + firstMi;
  const loanPayments = principal + totalInterest;
  const lifetimeHousing = cashToClose + loanPayments + totalMi + (taxes + insurance + input.hoa) * months;
  return { input, downPayment, base, principal, upfrontFee, upfrontRate, annualMiRate, pi, taxes, insurance, mi: firstMi, monthly, closingCosts, cashToClose, totalInterest, totalMi, loanPayments, lifetimeHousing, miEndMonth, annual };
}
