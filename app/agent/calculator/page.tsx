import type { Metadata } from "next";
import MortgageCalculator from "./mortgage-calculator";

export const metadata: Metadata = {
  title: "Mortgage Payment Calculator | T-Agent",
  description: "A free, easy mortgage calculator. Compare conventional, FHA, VA and USDA purchase loans with live home-price sliders, down payments, taxes, insurance and PMI.",
  alternates: { canonical: "https://www.tolley.io/agent/calculator" },
  openGraph: { title: "Find your comfortable monthly payment | T-Agent", description: "Move the slider. Explore your options. See the full payment. Free, with no sign-in.", url: "https://www.tolley.io/agent/calculator", type: "website" },
};

export default function CalculatorPage() {
  return <MortgageCalculator />;
}
