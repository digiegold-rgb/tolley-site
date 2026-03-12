import Link from "next/link";
import { VATER_COURSES } from "@/lib/vater";

export function CoursesCards() {
  return (
    <section className="relative z-10 mx-auto max-w-4xl px-6 py-16">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {VATER_COURSES.map((course) => (
          <div key={course.slug} className="vater-card flex flex-col p-8">
            {/* Icon + Title */}
            <div className="mb-4 flex items-center gap-3">
              <span className="text-4xl" role="img" aria-label={course.title}>
                {course.icon}
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-100">
                  {course.title}
                </h2>
                <p className="text-sm text-slate-400">{course.subtitle}</p>
              </div>
            </div>

            {/* Price badge */}
            <div className="mb-4">
              <span className="vater-badge vater-neon-amber !border-amber-500/30 !bg-amber-500/10 !text-amber-400">
                ${course.price} one-time
              </span>
            </div>

            {/* Audience */}
            <p className="mb-2 text-sm text-slate-400">
              <span className="font-semibold text-slate-300">For:</span>{" "}
              {course.audience}
            </p>

            {/* Module count */}
            <p className="mb-6 flex-1 text-sm text-slate-400">
              <span className="font-semibold text-sky-400">
                {course.moduleCount} modules
              </span>{" "}
              of practical, no-BS content
            </p>

            {/* CTA */}
            <Link
              href={`/vater/courses/${course.slug}`}
              className="vater-cta justify-center"
            >
              View Course
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
