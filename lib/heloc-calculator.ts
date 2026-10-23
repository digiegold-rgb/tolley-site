import { monthlyPrincipalInterest } from "./mortgage-calculator";

export type HelocInputs = {
  homeValue: number; mortgageBalance: number; otherLiens: number; cltv: number;
  lineLimit: number; drawn: number; drawYears: number; repayYears: number;
  drawMode: "interest" | "percent" | "amortizing"; minimumPercent: number;
  minimumPayment: number; amortizeYears: number; extraPayment: number;
  rateSource: "direct" | "index"; rate: number; indexRate: number; margin: number;
  floor: number; cap: number; repaymentRate: number;
  promo: boolean; promoRate: number; promoMonths: number;
  lock: boolean; lockAmount: number; lockRate: number; lockYears: number;
  repaymentType: "amortizing" | "balloon";
  openingFees: number; drawFee: number; annualFee: number; financeFees: boolean;
  earlyClosureFee: number; existingHousing: number;
};
export const DEFAULT_HELOC: HelocInputs = {
  homeValue: 400000, mortgageBalance: 250000, otherLiens: 0, cltv: 85,
  lineLimit: 90000, drawn: 50000, drawYears: 10, repayYears: 20,
  drawMode: "interest", minimumPercent: 1, minimumPayment: 0, amortizeYears: 20, extraPayment: 0,
  rateSource: "direct", rate: 8, indexRate: 6.75, margin: 1.25, floor: 0, cap: 18, repaymentRate: 8,
  promo: false, promoRate: 5, promoMonths: 6,
  lock: false, lockAmount: 25000, lockRate: 8, lockYears: 15,
  repaymentType: "amortizing", openingFees: 0, drawFee: 0, annualFee: 0,
  financeFees: false, earlyClosureFee: 0, existingHousing: 0,
};
export function normalizeHeloc(raw: Partial<HelocInputs>): HelocInputs {
  const d = DEFAULT_HELOC;
  const num = (key: keyof HelocInputs, min: number, max: number, integer = false) => {
    const value = raw[key];
    const n = typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : d[key] as number;
    return integer ? Math.round(n) : n;
  };
  const bool = (key: keyof HelocInputs) => typeof raw[key] === "boolean" ? raw[key] as boolean : d[key] as boolean;
  const lineLimit = num("lineLimit", 0, 5000000);
  const floor = num("floor", 0, 36);
  const cap = Math.max(floor, num("cap", 0, 36));
  const drawn = Math.min(lineLimit, num("drawn", 0, 5000000));
  const drawYears = num("drawYears", 0, 20, true);
  const repayYears = num("repayYears", 1, 30, true);
  const openingFees = num("openingFees", 0, 100000);
  const drawFee = num("drawFee", 0, 10000);
  const initialBalance = drawn + (bool("financeFees") ? openingFees + (drawn > 0 ? drawFee : 0) : 0);
  return {
    homeValue: num("homeValue", 10000, 10000000), mortgageBalance: num("mortgageBalance", 0, 10000000), otherLiens: num("otherLiens", 0, 10000000), cltv: num("cltv", 1, 100),
    lineLimit, drawn, drawYears, repayYears,
    drawMode: ["interest", "percent", "amortizing"].includes(raw.drawMode ?? "") ? raw.drawMode! : d.drawMode,
    minimumPercent: num("minimumPercent", .1, 10), minimumPayment: num("minimumPayment", 0, 10000), amortizeYears: num("amortizeYears", 1, 30, true), extraPayment: num("extraPayment", 0, 100000),
    rateSource: raw.rateSource === "index" ? "index" : "direct", rate: num("rate", 0, 36), indexRate: num("indexRate", 0, 36), margin: num("margin", -10, 20), floor, cap, repaymentRate: num("repaymentRate", 0, 36),
    promo: bool("promo"), promoRate: num("promoRate", 0, 36), promoMonths: num("promoMonths", 1, 24, true),
    lock: bool("lock"), lockAmount: Math.min(initialBalance, num("lockAmount", 0, 6000000)), lockRate: num("lockRate", 0, 36), lockYears: Math.min(num("lockYears", 1, 30, true), Math.max(1, drawYears + (raw.repaymentType === "balloon" ? 0 : repayYears))),
    repaymentType: raw.repaymentType === "balloon" ? "balloon" : "amortizing",
    openingFees, drawFee, annualFee: num("annualFee", 0, 10000), financeFees: bool("financeFees"), earlyClosureFee: num("earlyClosureFee", 0, 100000), existingHousing: num("existingHousing", 0, 100000),
  };
}
export function calculateHeloc(raw: HelocInputs) {
  const input = normalizeHeloc(raw);
  const i = input;
  const drawMonths = i.drawYears * 12;
  const repayMonths = i.repaymentType === "balloon" ? 0 : i.repayYears * 12;
  const totalMonths = drawMonths + repayMonths;
  const limitedRate = (rate: number) => Math.max(i.floor, Math.min(i.cap, rate));
  const ongoingRate = limitedRate(i.rateSource === "index" ? i.indexRate + i.margin : i.rate);
  const repaymentRate = limitedRate(i.repaymentRate);
  const upfrontFees = i.openingFees + (i.drawn > 0 ? i.drawFee : 0);
  const financedFees = i.financeFees ? upfrontFees : 0;
  const initialBalance = i.drawn + financedFees;
  const locked = i.lock ? Math.min(i.lockAmount, initialBalance) : 0;
  const lockMonths = Math.min(i.lockYears * 12, Math.max(1, totalMonths));
  const fixedPayment = monthlyPrincipalInterest(locked, i.lockRate, lockMonths);
  const capacity = Math.max(0, i.homeValue * i.cltv / 100 - i.mortgageBalance - i.otherLiens);
  const availableCredit = Math.max(0, i.lineLimit - initialBalance);
  function drawPayment(balance: number, rate: number, month: number) {
    if (balance <= 0) return 0;
    const interest = balance * rate / 1200;
    const scheduled = i.drawMode === "percent" ? balance * i.minimumPercent / 100 : i.drawMode === "amortizing" ? monthlyPrincipalInterest(balance, rate, Math.max(1, i.amortizeYears * 12 - month + 1)) : interest;
    return Math.min(balance + interest, Math.max(interest, i.minimumPayment, scheduled));
  }
  let variableBalance = initialBalance - locked;
  let fixedBalance = locked;
  let repaymentBase = variableBalance;
  let drawEndBalance = initialBalance;
  let totalInterest = 0;
  let totalPayments = 0;
  let firstPayment = 0;
  let firstInterest = 0;
  let firstPrincipal = 0;
  let firstExtra = 0;
  let firstRepayment = 0;
  let lastDrawPayment = 0;
  let payoffMonth = 0;
  const annual: { year: number; interest: number; principal: number; balance: number }[] = [];
  for (let month = 1; month <= totalMonths; month++) {
    const isDraw = month <= drawMonths;
    if (month === drawMonths + 1) repaymentBase = variableBalance;
    const rate = isDraw ? i.promo && month <= i.promoMonths ? i.promoRate : ongoingRate : repaymentRate;
    const variableInterest = variableBalance * rate / 1200;
    const fixedInterest = fixedBalance * i.lockRate / 1200;
    const variableScheduled = isDraw ? drawPayment(variableBalance, rate, month) : Math.min(variableBalance + variableInterest, monthlyPrincipalInterest(repaymentBase, repaymentRate, repayMonths));
    const fixedScheduled = Math.min(fixedBalance + fixedInterest, fixedPayment);
    let variablePrincipal = Math.max(0, variableScheduled - variableInterest);
    let fixedPrincipal = Math.max(0, fixedScheduled - fixedInterest);
    const extraVariable = Math.min(i.extraPayment, Math.max(0, variableBalance - variablePrincipal));
    const extraFixed = Math.min(Math.max(0, i.extraPayment - extraVariable), Math.max(0, fixedBalance - fixedPrincipal));
    variablePrincipal += extraVariable;
    fixedPrincipal += extraFixed;
    const principal = variablePrincipal + fixedPrincipal;
    const interest = variableInterest + fixedInterest;
    const payment = principal + interest;
    variableBalance = Math.max(0, variableBalance - variablePrincipal);
    fixedBalance = Math.max(0, fixedBalance - fixedPrincipal);
    if (variableBalance < .000001) variableBalance = 0;
    if (fixedBalance < .000001) fixedBalance = 0;
    totalInterest += interest;
    totalPayments += payment;
    if (month === 1) { firstPayment = payment; firstInterest = interest; firstExtra = extraVariable + extraFixed; firstPrincipal = principal - firstExtra; }
    if (month === drawMonths) { drawEndBalance = variableBalance + fixedBalance; lastDrawPayment = payment; }
    if (month === drawMonths + 1) firstRepayment = payment;
    if (initialBalance > 0 && variableBalance + fixedBalance === 0 && !payoffMonth) payoffMonth = month;
    const year = Math.ceil(month / 12);
    if (!annual[year - 1]) annual.push({ year, interest: 0, principal: 0, balance: 0 });
    annual[year - 1].interest += interest;
    annual[year - 1].principal += principal;
    annual[year - 1].balance = variableBalance + fixedBalance;
  }
  const balloon = i.repaymentType === "balloon" ? variableBalance + fixedBalance : 0;
  const annualFees = i.annualFee * totalMonths / 12;
  const cashFees = i.financeFees ? 0 : upfrontFees;
  const totalFees = upfrontFees + annualFees;
  const totalOutlay = totalPayments + balloon + cashFees + annualFees;
  const monthlyBudget = firstPayment + i.annualFee / 12;
  const firstRate = drawMonths > 0 ? i.promo ? i.promoRate : ongoingRate : repaymentRate;
  const sensitivity = [-2, -1, 0, 1, 2].map(delta => {
    const rate = limitedRate(ongoingRate + delta);
    const variable = initialBalance - locked;
    const base = drawMonths > 0 ? drawPayment(variable, rate, 1) : monthlyPrincipalInterest(variable, limitedRate(repaymentRate + delta), repayMonths || 1);
    const totalDue = variable + variable * (drawMonths > 0 ? rate : limitedRate(repaymentRate + delta)) / 1200 + locked + locked * i.lockRate / 1200;
    return { delta, rate: drawMonths > 0 ? rate : limitedRate(repaymentRate + delta), payment: Math.min(totalDue, base + fixedPayment + i.extraPayment) + i.annualFee / 12 };
  });
  return { input, capacity, availableCredit, initialBalance, locked, ongoingRate, repaymentRate, firstRate,
    financedFees, cashFees, totalFees, annualFees, fixedPayment, firstPayment, firstInterest, firstPrincipal, firstExtra,
    monthlyBudget, combinedBudget: monthlyBudget + i.existingHousing,
    drawEndBalance, firstRepayment, lastDrawPayment, balloon, totalInterest, totalOutlay, payoffMonth, annual, sensitivity,
    overEquityLimit: i.lineLimit > capacity + .005, overCreditLimit: initialBalance > i.lineLimit + .005,
    combinedLtv: (i.mortgageBalance + i.otherLiens + i.lineLimit) / i.homeValue * 100,
  };
}
export type HelocResult = ReturnType<typeof calculateHeloc>;
