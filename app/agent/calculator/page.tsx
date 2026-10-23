import type { Metadata } from "next";
import MortgageCalculator from "./mortgage-calculator";

export const metadata: Metadata = {
  title: "Mortgage & HELOC Payment Calculator | T-Agent",
  description: "Free mortgage and HELOC calculators. Compare home purchase payments, home equity credit lines, draw and repayment periods, variable or fixed-rate options, fees and total costs.",
  alternates: { canonical: "https://www.tolley.io/agent/calculator" },
  openGraph: { title: "Find your comfortable monthly payment | T-Agent", description: "Move the slider. Explore your options. See the full payment. Free, with no sign-in.", url: "https://www.tolley.io/agent/calculator", type: "website" },
};

export default function CalculatorPage() {
  return <MortgageCalculator />;
}
