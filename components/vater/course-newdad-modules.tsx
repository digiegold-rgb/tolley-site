import { NEWDAD_COURSE } from "@/lib/vater";

export function CourseNewdadModules() {
  return (
    <section className="relative z-10 mx-auto max-w-4xl px-6 py-16">
      <h2 className="vater-section-title mb-2 text-center">Course Modules</h2>
      <p className="vater-section-subtitle mx-auto mb-10 text-center">
        {NEWDAD_COURSE.moduleCount} modules from delivery room to second
        birthday &mdash; the stuff nobody tells you.
      </p>

      <div className="flex flex-col gap-4">
        {NEWDAD_COURSE.modules.map((mod) => (
          <div key={mod.number} className="vater-module">
            <div className="vater-module-number">{mod.number}</div>
            <div>
              <h3 className="font-bold text-slate-100">{mod.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                {mod.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
