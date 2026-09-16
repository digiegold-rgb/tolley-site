import type { Metadata } from "next";
import { headers } from "next/headers";
import { Fredoka } from "next/font/google";
import { EventTracker } from "@/components/analytics/site-tracker";
import { FoodNav } from "@/components/food/food-nav";
import { FoodSparkles } from "@/components/food/food-sparkles";
import { FoodChat } from "@/components/food/food-chat";
import { isFoodPinGateExempt, resolveFoodAccess } from "@/lib/food/auth";
import { FoodPinGate } from "./food-pin-gate";
import "./food.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
});

/* Every /food page is session + Prisma. Do not SSG this tree. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function FoodLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-tolley-pathname") || "";
  const access = isFoodPinGateExempt(pathname) ? { ok: true } : await resolveFoodAccess();

  if (!access.ok) {
    return (
      <div className={`food-page ${fredoka.variable}`}>
        <FoodPinGate />
      </div>
    );
  }

  return (
    <div className={`food-page ${fredoka.variable}`}>
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
