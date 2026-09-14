import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { jellyDisplay, jellySerif } from "@/components/animate/fonts";
import "./generate.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Generate | Jelly Studio · Tolley.io",
  description:
    "Create images and videos with a guided workflow: choose your output, add a prompt and sources, adjust every setting, then generate and review.",
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
