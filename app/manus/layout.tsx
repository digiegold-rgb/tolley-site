import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";

import { SiteTracker } from "@/components/analytics/site-tracker";
import "./manus.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Manus | Autonomous AI Agent | Tolley.io",
  description:
    "Fire-and-forget autonomous AI agent. Give it a task, walk away, get results.",
};

export default function ManusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`manus-page ${jetbrainsMono.variable}`}>
      <SiteTracker site="manus" />
      <div className="manus-scanline" />
      {children}
    </div>
  );
}
