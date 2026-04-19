import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import { auth } from "@/auth";
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
    "AI-powered kitchen hub for meal planning, grocery lists, pantry tracking, and recipe discovery. Scan receipts, compare prices, and never run out of essentials. Yummly refugees welcome.",
  keywords: [
    "AI meal planning",
    "smart grocery list",
    "meal planning app",
    "pantry tracker",
    "recipe discovery AI",
    "grocery budget tracker",
    "family meal planner",
    "Yummly alternative",
    "PlateJoy alternative",
    "Ruthann's Kitchen",
  ],
  openGraph: {
    title: "Ruthann's Kitchen | Smart Meal Planning for Real Families",
    description:
      "AI-powered meal planning, grocery lists, pantry tracking, and budget analytics. Import your orphaned Yummly recipes. $39/year, 30-day free trial.",
    type: "website",
    url: "https://www.tolley.io/food",
    siteName: "Ruthann's Kitchen",
    // opengraph-image.tsx in this directory auto-generates the preview image
  },
  twitter: {
    card: "summary_large_image",
    title: "Ruthann's Kitchen | Smart Meal Planning for Real Families",
    description:
      "AI-powered meal planning, grocery lists, pantry tracking, and budget analytics. $39/year, 30-day free trial.",
  },
  alternates: {
    canonical: "https://www.tolley.io/food",
  },
};

export default async function FoodLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isAuthenticated = Boolean(session?.user?.id);

  return (
    <div className={`food-page ${fredoka.variable}`}>
      <SiteTracker site="food" />
      <EventTracker site="food">
        <FoodSparkles />
        <div
          aria-hidden="true"
          className="site-dot-grid-orange pointer-events-none fixed inset-0 z-0"
        />
        {isAuthenticated && <FoodNav />}
        <main
          style={{
            position: "relative",
            zIndex: 2,
            minHeight: "100vh",
            paddingBottom: isAuthenticated ? "calc(64px + env(safe-area-inset-bottom))" : 0,
          }}
        >
          {children}
        </main>
        {isAuthenticated && <FoodChat />}
      </EventTracker>
    </div>
  );
}
