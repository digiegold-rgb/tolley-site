import type { Metadata } from "next";
import { CourseNewdadHero } from "@/components/vater/course-newdad-hero";
import { CourseNewdadModules } from "@/components/vater/course-newdad-modules";
import { CourseNewdadCta } from "@/components/vater/course-newdad-cta";

export const metadata: Metadata = {
  title: "New Dad's First 2 Years | Vater Ventures",
  description:
    "The no-BS guide from a dad who's been there. 10 modules from delivery room to second birthday. $27 one-time.",
};

export default function NewdadCoursePage() {
  return (
    <main>
      <CourseNewdadHero />
      <CourseNewdadModules />
      <CourseNewdadCta />
    </main>
  );
}
