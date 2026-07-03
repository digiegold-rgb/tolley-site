import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { SiteTracker } from "@/components/analytics/site-tracker";
import "./water.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pool Water Management | Tolley",
  description: "AI-powered pool water chemistry dashboard",
  robots: "noindex, nofollow",
};

export default function WaterLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`water-page ${nunito.variable}`}>
      <SiteTracker site="water" />
      <div aria-hidden="true" className="site-dot-grid-cyan pointer-events-none fixed inset-0 z-0" />
      <main className="water-shell relative min-h-screen overflow-hidden px-4 py-6 sm:px-8 sm:py-8">
        <div aria-hidden className="water-spotlight water-spotlight-left" />
        <div aria-hidden className="water-spotlight water-spotlight-right" />
        <section className="relative z-20 mx-auto w-full max-w-7xl">
          {children}
        </section>
      </main>
    </div>
  );
}
