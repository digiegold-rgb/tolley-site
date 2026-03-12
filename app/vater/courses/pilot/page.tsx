import type { Metadata } from "next";
import { CoursePilotHero } from "@/components/vater/course-pilot-hero";
import { CoursePilotModules } from "@/components/vater/course-pilot-modules";
import { CoursePilotCta } from "@/components/vater/course-pilot-cta";

export const metadata: Metadata = {
  title: "How to Become a Pilot | Vater Ventures",
  description:
    "From zero hours to certified pilot — the real roadmap. 10 modules covering everything from first discovery flight to airline career. $27 one-time.",
};

export default function PilotCoursePage() {
  return (
    <main>
      <CoursePilotHero />
      <CoursePilotModules />
      <CoursePilotCta />
    </main>
  );
}
