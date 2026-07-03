import type { Metadata } from "next";
import { FoodBusinessLanding } from "@/components/food/food-business-landing";

export const metadata: Metadata = {
  title: "White-Label Meal-Plan Platform for Food Businesses | Ruthann's Kitchen",
  description:
    "Give your clients a branded meal-planning & grocery app. White-label platform for dietitians, meal-prep companies, trainers and personal chefs. Your brand, our AI engine. From $99/mo — live in days.",
  openGraph: {
    title: "Stop sending meal plans as PDFs — give clients a branded app",
    description:
      "White-label meal-planning & grocery platform for nutritionists, meal-prep companies, trainers and chefs. Your brand, your clients, our AI engine.",
    type: "website",
    url: "https://www.tolley.io/food/business",
  },
  alternates: {
    canonical: "https://www.tolley.io/food/business",
  },
};

export default function FoodBusinessPage() {
  return <FoodBusinessLanding />;
}
