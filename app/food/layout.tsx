import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import { SiteTracker, EventTracker } from "@/components/analytics/site-tracker";
import { FoodNav } from "@/components/food/food-nav";
import { FoodSparkles } from "@/components/food/food-sparkles";
import { FoodChat } from "@/components/food/food-chat";
import "./food.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ruthann's Kitchen | Smart Meal Planning & Grocery Lists",
  description:
    "AI-powered kitchen hub for meal planning, grocery lists, pantry tracking, and recipe discovery. Scan receipts, compare prices, and never run out of essentials.",
  openGraph: {
    title: "Ruthann's Kitchen | Smart Meal Planning",
    description:
      "AI-powered kitchen hub for meal planning, grocery lists, pantry tracking, and recipe discovery.",
    type: "website",
    url: "https://www.tolley.io/food",
  },
  alternates: {
    canonical: "https://www.tolley.io/food",
  },
};

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`food-page ${fredoka.variable}`}>
      <SiteTracker site="food" />
      <EventTracker site="food">
        <FoodSparkles />
        <FoodNav />
        <main style={{ position: "relative", zIndex: 2, minHeight: "calc(100vh - 56px)" }}>
          {children}
        </main>
        <FoodChat />
      </EventTracker>
    </div>
  );
}
