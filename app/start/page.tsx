import type { Metadata } from "next";
import { directoryByGroup } from "@/lib/directory";
import { StartDirectory } from "@/components/start/start-directory";
import "./start.css";

export const metadata: Metadata = {
  title: "Find your next step | Tolley.io",
  description:
    "Find Tolley services, rentals, shopping, real estate, and creative tools. Local to Kansas City, built to get things done.",
  alternates: { canonical: "https://www.tolley.io/start" },
  openGraph: {
    title: "Find your next step | Tolley.io",
    description: "Local services. Useful tools. One place to start.",
    url: "https://www.tolley.io/start",
    type: "website",
  },
};

export default function StartPage() {
  return <StartDirectory groups={directoryByGroup()} />;
}
