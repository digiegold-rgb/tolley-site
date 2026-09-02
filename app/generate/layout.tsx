import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { jellyDisplay, jellySerif } from "@/components/animate/fonts";
import "./generate.css";

export const metadata: Metadata = {
  title: "Generate | Jelly Studio · Tolley.io",
  description:
    "Talk to Generate — Qwen 3.8 on Spark writes Inference and Description, then you run Text→Image, Text→Video, Image→Video, or Video→Video.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0A0A14",
};

export default function GenerateLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${jellyDisplay.variable} ${jellySerif.variable} gen-root`}>
      {children}
    </div>
  );
}
