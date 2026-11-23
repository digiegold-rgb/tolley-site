import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jelly Studio Demo — Watch a Finished Film & Explore the Editor",
  description: "Watch a finished Jelly Studio film and explore the real editor without signing up. The demo is read-only; creating a video requires an account and prepaid credits.",
  alternates: { canonical: "https://www.tolley.io/animate/demo" },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
